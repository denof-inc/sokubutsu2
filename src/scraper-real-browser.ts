import { connect } from 'puppeteer-real-browser';
import { ScrapingResult, PropertyInfo } from './types.js';
import { vibeLogger } from './logger.js';
import * as crypto from 'crypto';

/**
 * Puppeteer Real Browserを使用したスクレイパー（最終手段）
 * 
 * @設計ドキュメント
 * - Cloudflare等の高度なボット検出を回避
 * - 実際のブラウザとして動作
 * 
 * @関連クラス
 * - SimpleScraper: プライマリのHTTP-onlyスクレイパー
 * - PuppeteerScraper: 第2段階のスクレイパー
 * - MonitoringScheduler: スクレイピング機能を呼び出す
 * 
 * @主要機能
 * - 実ブラウザとしての動作によるボット検出回避
 * - Turnstile CAPTCHA自動解決
 * - 実行時間: 20-40秒（最も重いが最も確実）
 * - メモリ使用量: 300-500MB
 */
export class RealBrowserScraper {
  private readonly timeout = 40000; // 40秒タイムアウト

  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let browser = null;
    let page = null;

    try {
      vibeLogger.info('real-browser.start', `Real Browserスクレイピング開始: ${url}`, {
        context: { url, method: 'puppeteer-real-browser' },
        humanNote: '最終手段: Real Browser（実ブラウザモード）',
      });

      // Real Browserで接続
      const result = await connect({
        headless: false, // ヘッドレスモードを無効化（より実際のブラウザに近い）
        
        // Turnstile CAPTCHA自動解決を有効化
        turnstile: true,
        
        // カスタム設定
        customConfig: {},
        
        // 接続オプション
        connectOption: {
          defaultViewport: null, // ビューポートを自動調整
        },
        
        // Chrome起動引数
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
        ],
        
        // Xvfbを無効化（MacOS/Windowsの場合）
        disableXvfb: process.platform !== 'linux',
      });

      browser = result.browser;
      page = result.page;

      // ランダムな遅延を追加（人間らしさ）
      const initialDelay = Math.floor(Math.random() * 3000) + 2000;
      await this.sleep(initialDelay);

      // マウスをランダムに動かす（人間らしさ）
      await this.randomMouseMovement(page);

      // ページにアクセス
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // ページ読み込み完了を待つ
      await this.sleep(3000);

      // スクロール（人間らしい動作）
      await this.humanLikeScroll(page);

      // 認証ページのチェック
      const title = await page.title();
      const bodyText = await page.evaluate(() => {
        const body = (globalThis as any).document?.body;
        return body?.innerText || '';
      });

      if (title.includes('認証') || bodyText.includes('認証にご協力ください')) {
        vibeLogger.warn('real-browser.auth_detected', '認証ページが検出されました（Real Browser）', {
          context: { url, title },
          humanNote: 'Real Browserでも認証ページが表示された',
        });
        
        // CAPTCHAが解決されるのを待つ
        await this.sleep(5000);
        
        // 再度チェック
        const newTitle = await page.title();
        if (newTitle.includes('認証')) {
          throw new Error('認証ページを回避できませんでした');
        }
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
            'real-browser.selector.found',
            `有効なセレクター発見: ${selector} (${elements.length}件)`,
            {
              context: { selector, count: elements.length },
            }
          );
          break;
        }
      }

      if (properties.length === 0) {
        throw new Error('物件要素が見つかりませんでした（Real Browser）');
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

      vibeLogger.info('real-browser.success', 'Real Browserスクレイピング完了', {
        context: {
          url,
          executionTime,
          selector: usedSelector,
          hash,
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          propertiesFound: propertyInfoList.length,
        },
        humanNote: 'パフォーマンス目標: 20-40秒、メモリ300-500MB',
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

      vibeLogger.error('real-browser.failed', `Real Browserスクレイピング失敗: ${url}`, {
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

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ランダムなマウス移動（人間らしさ）
   */
  private async randomMouseMovement(page: any): Promise<void> {
    try {
      const mouse = page.mouse;
      
      // ランダムな位置にマウスを移動
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * 800) + 100;
        const y = Math.floor(Math.random() * 600) + 100;
        await mouse.move(x, y, { steps: 10 });
        await this.sleep(Math.random() * 500 + 200);
      }
    } catch (error) {
      vibeLogger.debug('real-browser.mouse.error', 'マウス移動エラー', {
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * 人間らしいスクロール
   */
  private async humanLikeScroll(page: any): Promise<void> {
    try {
      // ゆっくりとスクロール
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const doc = (globalThis as any).document;
            const win = (globalThis as any).window;
            const scrollHeight = doc?.body?.scrollHeight || 1000;
            win?.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight / 3) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      
      await this.sleep(1000);
      
      // トップに戻る
      await page.evaluate(() => {
        const win = (globalThis as any).window;
        win?.scrollTo(0, 0);
      });
    } catch (error) {
      vibeLogger.debug('real-browser.scroll.error', 'スクロールエラー', {
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
}