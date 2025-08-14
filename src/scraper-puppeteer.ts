import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapingResult, PropertyInfo } from './types.js';
import { vibeLogger } from './logger.js';
import * as crypto from 'crypto';
import { RealBrowserScraper } from './scraper-real-browser.js';

// Stealth Pluginの詳細設定
const stealth = StealthPlugin();
// 特定のevasionを無効化（必要に応じて）
// stealth.enabledEvasions.delete('chrome.runtime');

puppeteer.use(stealth);

/**
 * Puppeteerベースのスクレイパー（フォールバック用）
 * 
 * @設計ドキュメント
 * - docs/スクレイピング戦略ルール.md: 段階的フォールバック戦略
 * 
 * @関連クラス
 * - SimpleScraper: プライマリのHTTP-onlyスクレイパー
 * - MonitoringScheduler: スクレイピング機能を呼び出す
 * 
 * @主要機能
 * - Puppeteer + Stealth Pluginによる認証回避
 * - 実行時間: 15-25秒（重いが確実）
 * - メモリ使用量: 200-300MB
 */
export class PuppeteerScraper {
  private readonly timeout = 30000; // 30秒タイムアウト

  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let browser = null;

    try {
      vibeLogger.info('puppeteer.start', `Puppeteerスクレイピング開始: ${url}`, {
        context: { url, method: 'puppeteer-stealth' },
        humanNote: 'フォールバック戦略: Puppeteer + Stealth Plugin',
      });

      // ブラウザ起動設定
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });

      const page = await browser.newPage();

      // ユーザーエージェント設定
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
      );

      // ビューポート設定
      await page.setViewport({ width: 1920, height: 1080 });

      // ランダムな遅延を追加
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // ページにアクセス
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // ページ読み込み完了を待つ
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 認証ページのチェック
      const title = await page.title();
      const bodyText = await page.evaluate(() => {
        const body = (globalThis as any).document?.body;
        return body?.innerText || '';
      });

      if (title.includes('認証') || bodyText.includes('認証にご協力ください')) {
        vibeLogger.warn('puppeteer.auth_detected', '認証ページが検出されました。Real Browserにフォールバック', {
          context: { url, title },
          humanNote: 'Puppeteer Stealth失敗。Real Browserへフォールバック',
        });
        
        // Real Browserへフォールバック
        await browser.close();
        const realBrowserScraper = new RealBrowserScraper();
        return await realBrowserScraper.scrapeAthome(url);
      }

      // 物件要素の取得
      const selectors = [
        'athome-search-result-list-item',
        'athome-buy-other-object-list-item',
        'athome-object-item',
        '[class*="property"]',
        '[class*="bukken"]',
        '[class*="item"]',
        '.item-cassette',
        '.property-list-item',
        'article',
        '[data-item]',
        '[data-property]',
      ];

      let properties: any[] = [];
      let usedSelector = '';

      for (const selector of selectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          properties = elements;
          usedSelector = selector;
          vibeLogger.debug(
            'puppeteer.selector.found',
            `有効なセレクター発見: ${selector} (${elements.length}件)`,
            {
              context: { selector, count: elements.length },
            }
          );
          break;
        }
      }

      if (properties.length === 0) {
        throw new Error('物件要素が見つかりませんでした（Puppeteer）');
      }

      // 物件情報の抽出
      const propertyInfoList: PropertyInfo[] = [];
      const contentTextArray: string[] = [];

      for (let i = 0; i < Math.min(3, properties.length); i++) {
        const element = properties[i];
        const text = await element.evaluate((el: any) => el.textContent || '');
        contentTextArray.push(text);

        // タイトル、価格、所在地を抽出
        const title = text.split('\n')[0]?.trim() || '';
        const price = text.match(/[0-9,]+万円/)?.[0] || '';
        const location = text.match(/広島[市県][\s\S]+?[区町]/)?.[0] || '';

        if (title && price) {
          propertyInfoList.push({
            title,
            price,
            ...(location ? { location } : {}),
          });
        }
      }

      const count = properties.length;
      const contentText = contentTextArray.join('\n');
      const hash = crypto.createHash('md5').update(contentText).digest('hex');
      const executionTime = Date.now() - startTime;

      vibeLogger.info('puppeteer.success', 'Puppeteerスクレイピング完了', {
        context: {
          url,
          executionTime,
          selector: usedSelector,
          hash,
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          propertiesFound: propertyInfoList.length,
        },
        humanNote: 'パフォーマンス目標: 15-25秒、メモリ200-300MB',
      });

      return {
        success: true,
        hash,
        count,
        properties: propertyInfoList,
        executionTime,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      vibeLogger.error('puppeteer.failed', `Puppeteerスクレイピング失敗: ${url}`, {
        context: {
          url,
          executionTime,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
        },
      });

      return {
        success: false,
        hash: '',
        count: 0,
        error: errorMessage,
        executionTime,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}