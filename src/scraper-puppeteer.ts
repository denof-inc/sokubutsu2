import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'puppeteer';
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

  /**
   * Cookie管理とコンテキスト分離による認証回避を実装
   * 各段階でCookieクリアを行い、認証検知時はリトライロジックを実行
   */
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let browser: Browser | undefined;
    let retryCount = 0;
    const maxRetries = 2;

    try {
      vibeLogger.info('puppeteer.start', `Puppeteer スクレイピング開始: ${url}`, {
        context: { url, maxRetries },
      });

      // リトライループの開始
      while (retryCount <= maxRetries) {
        try {
          browser = (await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--window-size=1920,1080',
              '--disable-web-security', // Cookie isolation強化
              '--disable-features=VizDisplayCompositor', // Bot検知回避
            ],
            protocolTimeout: 60000,
          }));

          // 独立したブラウザコンテキストを作成（正しいメソッド使用）
          const context = await browser.createBrowserContext();
          const page = await context.newPage();

          // ページタイムアウト設定（20秒に変更）
          page.setDefaultTimeout(20000);
          page.setDefaultNavigationTimeout(20000);

          vibeLogger.info(
            'puppeteer.context_created',
            `新しいコンテキスト作成（試行${retryCount + 1}/${maxRetries + 1}）`,
            {
              context: { retryCount },
            }
          );

          // 基本的なWebdriver検出回避（強化版）
          await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });

            // Chrome Detection Evasion強化
            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5],
            });

            // Language設定の自然化
            Object.defineProperty(navigator, 'languages', {
              get: () => ['ja-JP', 'ja', 'en-US', 'en'],
            });
          });

          await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          );
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          });

          // 3段階アクセスパターン（Cookie管理強化版）
          vibeLogger.info(
            'puppeteer.step1',
            'ステップ1: Cookie完全クリア後、bot.sannysoft.com でボット検出テスト',
            {
              context: { retryCount },
            }
          );

          // Cookie完全削除
          const client = await page.target().createCDPSession();
          await client.send('Network.clearBrowserCookies');
          await client.send('Network.clearBrowserCache');

          await page.goto('https://bot.sannysoft.com', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
          await new Promise(r => setTimeout(r, 3000));

          vibeLogger.info(
            'puppeteer.step2',
            'ステップ2: Cookie再クリア後、Google経由でリファラー自然化',
            {
              context: { retryCount },
            }
          );

          // Google前にもCookie削除
          await client.send('Network.clearBrowserCookies');

          await page.goto('https://www.google.com', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
          await new Promise(r => setTimeout(r, 3000));

          vibeLogger.info('puppeteer.step3', 'ステップ3: Cookie維持状態でアットホームへアクセス', {
            context: { url, retryCount },
          });

          // アットホーム前はCookieをそのまま維持（Google経由の自然性を保持）
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });
          await new Promise(r => setTimeout(r, 5000));

          // ページタイトルとコンテンツを取得
          const pageTitle: string = await page.title();
          const pageContent: string = await page.content();

          // 認証ページチェック（強化版リトライロジック）
          if (pageTitle.includes('認証') || pageContent.includes('認証にご協力ください')) {
            vibeLogger.warn(
              'puppeteer.auth_detected',
              `認証ページを検出（試行${retryCount + 1}/${maxRetries + 1}）`,
              {
                context: { title: pageTitle, retryCount },
              }
            );

            if (retryCount < maxRetries) {
              vibeLogger.info(
                'puppeteer.auth_retry',
                '認証回避のため新しいコンテキストでリトライ',
                {
                  context: { retryCount: retryCount + 1 },
                }
              );

              // コンテキストとブラウザを完全にクリーンアップ
              await context.close();
              await browser.close();

              retryCount++;

              // 指数バックオフ待機
              const waitTime = Math.pow(2, retryCount) * 2000;
              await new Promise(r => setTimeout(r, waitTime));

              continue; // リトライループを継続
            } else {
              throw new Error(`認証ページが継続表示されています（${maxRetries + 1}回試行後）`);
            }
          }

          // 認証成功時の処理を継続

          // Cookieを取得して保存
          const cookies = await page.cookies();
          vibeLogger.info('puppeteer.cookies_captured', 'Cookie取得成功（認証突破完了）', {
            context: { cookieCount: cookies.length, retryCount },
          });

          // 物件要素の取得（Web Componentsセレクタを使用）
          const properties: PropertyInfo[] = await page.evaluate((): PropertyInfo[] => {
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

            let foundElements: PropertyInfo[] = [];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              console.log(`Selector "${selector}": found ${elements.length} elements`);

              if (elements.length > 0) {
                // 最初の3件を取得
                const items = Array.from(elements)
                  .slice(0, 3)
                  .map((el: Element): PropertyInfo | null => {
                    const text = el.textContent ?? '';

                    // Web Componentsの場合、shadow DOMも考慮
                    let title = '';
                    let price = '';
                    let location = '';

                    // 通常のDOM要素から情報を取得
                    const linkEl = el.querySelector('a');
                    if (linkEl) {
                      title = linkEl.textContent?.trim() ?? '';
                    }

                    // タイトルが取得できない場合の代替手段
                    if (!title) {
                      const titleEl = el.querySelector(
                        '[class*="title"], h2, h3, h4, .bukken-name, .property-name'
                      );
                      if (titleEl) {
                        title = titleEl.textContent?.trim() ?? '';
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
                      price = priceEl.textContent?.trim() ?? '';
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
                      location = locationEl.textContent?.trim() ?? '';
                    }
                    if (!location) {
                      const locationMatch = text.match(/広島[市県][\s\S]{0,50}?[区町]/);
                      location = locationMatch ? locationMatch[0] : '';
                    }

                    console.log(`Item: title="${title}", price="${price}", location="${location}"`);

                    return title && price ? { title, price, location } : null;
                  })
                  .filter((item): item is PropertyInfo => item !== null);

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

          // 成功時のクリーンアップ
          await context.close();
          await browser.close();

          // 成功時はループを抜ける
          if (!properties || properties.length === 0) {
            vibeLogger.error('puppeteer.no_properties', '物件要素が見つかりません', {
              context: {
                url,
                title: pageTitle,
                htmlLength: pageContent.length,
                finalRetryCount: retryCount,
              },
            });
            throw new Error('物件要素が見つかりませんでした');
          }

          const hash = crypto
            .createHash('md5')
            .update(properties.map(p => `${p.title}${p.price}`).join(''))
            .digest('hex');

          const executionTime = Date.now() - startTime;

          vibeLogger.info(
            'puppeteer.success',
            'Puppeteer スクレイピング成功（Cookie管理・コンテキスト分離強化版）',
            {
              context: {
                url,
                executionTime,
                propertiesCount: properties.length,
                hash,
                cookies: cookies.length,
                finalRetryCount: retryCount,
                totalAttempts: retryCount + 1,
              },
            }
          );

          return {
            success: true,
            hash,
            count: properties.length,
            properties,
            executionTime,
            memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            cookies, // Cookieも返すように拡張
          };
        } catch (innerError: unknown) {
          const innerErrorMessage =
            innerError instanceof Error ? innerError.message : String(innerError);

          vibeLogger.warn('puppeteer.attempt_failed', `試行${retryCount + 1}失敗`, {
            context: { retryCount, error: innerErrorMessage },
          });

          // コンテキストとブラウザをクリーンアップ
          try {
            if (browser) {
              await browser.close();
            }
          } catch (cleanupError: unknown) {
            vibeLogger.warn('puppeteer.cleanup_failed', 'ブラウザクリーンアップ失敗', {
              context: {
                error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
              },
            });
          }

          if (retryCount < maxRetries) {
            retryCount++;
            const waitTime = Math.pow(2, retryCount) * 1000;
            vibeLogger.info('puppeteer.retry_wait', `${waitTime}ms待機後、リトライ`, {
              context: { retryCount, waitTime },
            });
            await new Promise(r => setTimeout(r, waitTime));
            continue; // リトライループを継続
          } else {
            throw innerError; // 最大リトライ数到達時は例外を再スロー
          }
        }
      } // リトライループの終了

      // ここに到達することはないはずだが、TypeScriptエラー回避のため
      throw new Error('予期しないエラー: リトライループを正常に完了できませんでした');
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 最終的なクリーンアップ
      try {
        if (browser) {
          await browser.close();
        }
      } catch (cleanupError: unknown) {
        vibeLogger.warn('puppeteer.final_cleanup_failed', 'ファイナルクリーンアップ失敗', {
          context: {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          },
        });
      }

      vibeLogger.error(
        'puppeteer.failed',
        'Puppeteer スクレイピング失敗（Cookie管理・コンテキスト分離強化版）',
        {
          context: {
            url,
            executionTime,
            error: errorMessage,
            finalRetryCount: retryCount,
            totalAttempts: retryCount + 1,
          },
        }
      );

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
