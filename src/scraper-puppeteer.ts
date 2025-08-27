import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapingResult, PropertyInfo } from './types.js';
import { vibeLogger } from './logger.js';
import * as crypto from 'crypto';

// Stealth Pluginの詳細設定
const stealth = StealthPlugin();
// すべてのevasionを有効化して最大限の回避効果を得る
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
  private readonly timeout = 60000; // 60秒タイムアウト

  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      vibeLogger.info('puppeteer.start', `Puppeteer スクレイピング開始: ${url}`, {
        context: { url },
      });

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
        ],
        protocolTimeout: 60000, // プロトコルタイムアウトを60秒に設定
      });

      const page = await browser.newPage();

      // ページタイムアウト設定（20秒に変更）
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(20000);

      // 基本的なWebdriver検出回避
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja',
      });

      // 3段階アクセスパターン（実証済み）
      vibeLogger.info('puppeteer.step1', 'ステップ1: bot.sannysoft.com でボット検出テスト', {});
      await page.goto('https://bot.sannysoft.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await new Promise(r => setTimeout(r, 2000));

      vibeLogger.info('puppeteer.step2', 'ステップ2: Google経由でリファラー自然化', {});
      await page.goto('https://www.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await new Promise(r => setTimeout(r, 2000));

      vibeLogger.info('puppeteer.step3', 'ステップ3: アットホームへアクセス', {
        context: { url },
      });
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await new Promise(r => setTimeout(r, 5000));

      // ページタイトルとコンテンツを取得
      const pageTitle = await page.title();
      const pageContent = await page.content();

      // 認証ページチェック
      if (pageTitle.includes('認証') || pageContent.includes('認証にご協力ください')) {
        vibeLogger.warn('puppeteer.auth_detected', '認証ページを検出 - 追加待機', {
          context: { title: pageTitle },
        });

        // 追加の待機とリロード
        await new Promise(r => setTimeout(r, 5000));
        await page.reload({ waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 3000));

        // 再チェック
        const retryTitle = await page.title();
        if (retryTitle.includes('認証')) {
          throw new Error('認証ページが継続表示されています');
        }
      }

      // Cookieを取得して保存
      const cookies = await page.cookies();
      vibeLogger.info('puppeteer.cookies_captured', 'Cookie取得成功', {
        context: { cookieCount: cookies.length },
      });

      // 物件要素の取得（Web Componentsセレクタを使用）
      const properties = await page.evaluate(() => {
        console.log('Starting property search...');
        console.log('Current URL:', window.location.href);
        console.log('Page title:', document.title);

        // Web Componentsを含む新しいセレクタ
        const selectors = [
          // Web Components
          'athome-csite-pc-part-rent-business-other-bukken-card',
          'athome-search-result-list-item',
          'athome-buy-other-object-list-item',
          'athome-object-item',
          // 従来のセレクタ
          '.item-cassette',
          '.p-main-cassette-item',
          '.cassette-item',
          '[class*="bukken-card"]',
          '[class*="property"]',
          '[class*="bukken"]',
          '[class*="item"]',
        ];

        let foundElements: any[] = [];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Selector "${selector}": found ${elements.length} elements`);

          if (elements.length > 0) {
            // 最初の3件を取得
            const items = Array.from(elements)
              .slice(0, 3)
              .map((el: any) => {
                const text = el.textContent || '';

                // Web Componentsの場合、shadow DOMも考慮
                let title = '';
                let price = '';
                let location = '';

                // 通常のDOM要素から情報を取得
                const linkEl = el.querySelector('a');
                if (linkEl) {
                  title = linkEl.textContent?.trim() || '';
                }

                // タイトルが取得できない場合の代替手段
                if (!title) {
                  const titleEl = el.querySelector(
                    '[class*="title"], h2, h3, h4, .bukken-name, .property-name'
                  );
                  if (titleEl) {
                    title = titleEl.textContent?.trim() || '';
                  }
                }

                if (!title) {
                  // テキストの最初の行をタイトルとする
                  const lines = text.split('\n').filter((line: string) => line.trim());
                  if (lines.length > 0) {
                    // 価格以外の最初の行をタイトルとする
                    for (const line of lines) {
                      if (!line.includes('万円') && line.length > 5) {
                        title = line.trim();
                        break;
                      }
                    }
                  }
                }

                // 価格を取得
                const priceEl = el.querySelector(
                  '[class*="price"], .bukken-price, .property-price'
                );
                if (priceEl) {
                  price = priceEl.textContent?.trim() || '';
                }
                if (!price) {
                  const priceMatch = text.match(/[0-9,]+万円/);
                  price = priceMatch ? priceMatch[0] : '';
                }

                // 場所を取得
                const locationEl = el.querySelector(
                  '[class*="location"], [class*="address"], .bukken-address'
                );
                if (locationEl) {
                  location = locationEl.textContent?.trim() || '';
                }
                if (!location) {
                  const locationMatch = text.match(/広島[市県][\s\S]{0,50}?[区町]/);
                  location = locationMatch ? locationMatch[0] : '';
                }

                console.log(`Item: title="${title}", price="${price}", location="${location}"`);

                return title && price ? { title, price, location } : null;
              })
              .filter(Boolean);

            if (items.length > 0) {
              foundElements = items;
              console.log(`Found ${items.length} valid items with selector "${selector}"`);
              break;
            }
          }
        }

        if (foundElements.length === 0) {
          console.log('No property elements found');
          console.log('Page HTML length:', document.body.innerHTML.length);

          // Web Componentsの存在確認
          const webComponents = Array.from(document.querySelectorAll('*')).filter(el =>
            el.tagName.includes('-')
          );
          console.log('Web Components found:', webComponents.length);
          if (webComponents.length > 0 && webComponents.length < 20) {
            webComponents.forEach(wc => {
              console.log('Web Component:', wc.tagName.toLowerCase());
            });
          }
        }

        return foundElements;
      });

      await browser.close();

      if (!properties || properties.length === 0) {
        vibeLogger.error('puppeteer.no_properties', '物件要素が見つかりません', {
          context: {
            url,
            title: pageTitle,
            htmlLength: pageContent.length,
          },
        });
        throw new Error('物件要素が見つかりませんでした');
      }

      const hash = crypto
        .createHash('md5')
        .update(properties.map((p: any) => `${p.title}${p.price}`).join(''))
        .digest('hex');

      const executionTime = Date.now() - startTime;

      vibeLogger.info('puppeteer.success', 'Puppeteer スクレイピング成功（3段階経由）', {
        context: {
          url,
          executionTime,
          propertiesCount: properties.length,
          hash,
          cookies: cookies.length,
        },
      });

      return {
        success: true,
        hash,
        count: properties.length,
        properties: properties as PropertyInfo[],
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        cookies, // Cookieも返すように拡張
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      vibeLogger.error('puppeteer.failed', 'Puppeteer スクレイピング失敗（3段階経由）', {
        context: {
          url,
          executionTime,
          error: errorMessage,
        },
      });

      return {
        success: false,
        hash: '',
        count: 0,
        error: errorMessage,
        failureReason: errorMessage.includes('認証')
          ? 'auth'
          : errorMessage.includes('timeout')
            ? 'network'
            : 'other',
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      };
    }
  }
}
