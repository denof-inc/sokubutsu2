import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
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
   * Headless 環境での Input.dispatchMouseEvent 内部エラーを回避するため、
   * マウス移動は try/catch で握り潰して継続する。
   */
  private async safeMouseMove(page: Page, x: number, y: number): Promise<void> {
    try {
      await page.mouse.move(x, y);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      vibeLogger.warn('puppeteer.mouse_move_skipped', 'Headless環境でのmouse.moveをスキップ', {
        context: { x, y, error: msg },
      });
    }
  }

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
      vibeLogger.info(
        'puppeteer.start',
        `Puppeteer スクレイピング開始（最新突破技術適用版）: ${url}`,
        {
          context: { url, maxRetries },
          humanNote: 'Context7調査結果: Fingerprint偽装・高度Stealth・自然操作パターン適用',
        }
      );

      // リトライループの開始
      while (retryCount <= maxRetries) {
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--window-size=1920,1080',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor',
              // Context7調査: より高度な検出回避
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-extensions',
              '--no-first-run',
              '--no-default-browser-check',
              '--disable-infobars',
              '--disable-translate',
              '--disable-ipc-flooding-protection',
              // Fingerprint偽装強化
              '--enable-features=NetworkService,NetworkServiceLogging',
              '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            ],
            protocolTimeout: 120000, // Context7推奨: 2分に増加
          });

          // 独立したブラウザコンテキストを作成（正しいメソッド使用）
          const context = await browser.createBrowserContext();
          const page = await context.newPage();

          // Context7調査: 高度なFingerprint偽装
          await page.evaluateOnNewDocument(() => {
            // WebDriver検出完全回避
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });

            // Chrome Detection Evasion強化（Crawlee方式）
            Object.defineProperty(navigator, 'plugins', {
              get: () => [
                {
                  name: 'Chrome PDF Plugin',
                  filename: 'internal-pdf-viewer',
                  description: 'Portable Document Format',
                },
                {
                  name: 'Chromium PDF Plugin',
                  filename: 'internal-pdf-viewer',
                  description: 'Portable Document Format',
                },
              ],
            });

            // Language設定の自然化（Context7推奨）
            Object.defineProperty(navigator, 'languages', {
              get: () => ['ja-JP', 'ja', 'en-US', 'en'],
            });

            // Memory・Hardware情報の偽装（Zendriver方式）
            Object.defineProperty(navigator, 'deviceMemory', {
              get: () => 8,
            });
            Object.defineProperty(navigator, 'hardwareConcurrency', {
              get: () => 8,
            });

            // Timezone・Platform偽装
            Object.defineProperty(navigator, 'platform', {
              get: () => 'Win32',
            });

            // Chrome runtime偽装（型安全版）
            interface ChromeRuntime {
              onConnect: undefined;
              onMessage: undefined;
            }
            (window as unknown as { chrome: { runtime: ChromeRuntime } }).chrome = {
              runtime: {
                onConnect: undefined,
                onMessage: undefined,
              },
            };

            // Permission API偽装（型安全バージョン）
            const originalQuery = window.navigator.permissions.query.bind(
              window.navigator.permissions
            );
            window.navigator.permissions.query = (
              parameters: PermissionDescriptor
            ): Promise<PermissionStatus> => {
              if (parameters.name === 'notifications') {
                return Promise.resolve({
                  state: 'granted' as PermissionState,
                  name: parameters.name,
                  onchange: null,
                  addEventListener: () => {},
                  removeEventListener: () => {},
                  dispatchEvent: () => true,
                } as PermissionStatus);
              }
              return originalQuery(parameters);
            };
          });

          // Context7推奨: より自然なUser-Agent設定
          await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          );

          // より詳細なHTTPヘッダー設定（Crawlee方式）
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          });

          // Viewport設定（Context7推奨の自然な解像度）
          await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
          });

          // ページタイムアウト設定（60秒に延長）
          page.setDefaultTimeout(this.timeout);
          page.setDefaultNavigationTimeout(this.timeout);

          vibeLogger.info(
            'puppeteer.context_created',
            `最新突破技術適用コンテキスト作成（試行${retryCount + 1}/${maxRetries + 1}）`,
            {
              context: { retryCount, fingerprintApplied: true, stealthEnhanced: true },
            }
          );

          // Context7調査: 3段階アクセスパターン + 自然な操作
          // 初回試行時のみウォームアップ（bot.sannysoft → Google）を実施
          const client = await page.target().createCDPSession();
          if (retryCount === 0) {
            vibeLogger.info(
              'puppeteer.step1',
              'ステップ1: 高度Stealth機能でbot.sannysoft.comテスト（初回のみ）',
              { context: { retryCount } }
            );

            // Cookie完全削除
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');

            await page.goto('https://bot.sannysoft.com', {
              waitUntil: 'domcontentloaded',
              timeout: this.timeout,
            });

            // 軽いスクロールのみ（mouse.moveは安全化済）
            await this.safeMouseMove(page, 100, 100);
            await new Promise(r => setTimeout(r, 800));
            await this.safeMouseMove(page, 500, 300);
            await page.evaluate(() => window.scrollTo(0, 100));
            await new Promise(r => setTimeout(r, 1200));

            vibeLogger.info(
              'puppeteer.step2',
              'ステップ2: Google経由でFingerprint偽装を維持（初回のみ）',
              {
                context: { retryCount },
              }
            );

            // Google前にもCookie削除
            await client.send('Network.clearBrowserCookies');

            await page.goto('https://www.google.com', {
              waitUntil: 'domcontentloaded',
              timeout: this.timeout,
            });

            // Google上で軽い操作
            await this.safeMouseMove(page, 200, 200);
            await page.evaluate(() => window.scrollTo(0, 50));
            await new Promise(r => setTimeout(r, 1200));
          }

          vibeLogger.info('puppeteer.step3', 'ステップ3: 強化された偽装でアットホームアクセス', {
            context: { url, retryCount },
          });

          // アットホーム前はCookieをそのまま維持（Google経由の自然性を保持）
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: this.timeout,
          });

          // アットホーム上でも自然な操作
          await this.safeMouseMove(page, 300, 400);
          await page.evaluate(() => window.scrollTo(0, 200));
          await new Promise(r => setTimeout(r, 3000));

          // ページタイトルとコンテンツを取得
          const pageTitle: string = await page.title();
          const pageContent: string = await page.content();

          // 認証ページチェック（強化版リトライロジック）
          if (pageTitle.includes('認証') || pageContent.includes('認証にご協力ください')) {
            vibeLogger.warn(
              'puppeteer.auth_detected',
              `認証ページを検出（試行${retryCount + 1}/${maxRetries + 1}）- 最新技術適用にも関わらず`,
              {
                context: { title: pageTitle, retryCount, stealthApplied: true },
              }
            );

            if (retryCount < maxRetries) {
              vibeLogger.info('puppeteer.auth_retry', 'より高度な偽装技術でリトライ実行', {
                context: { retryCount: retryCount + 1 },
              });

              // コンテキストとブラウザを完全にクリーンアップ
              await context.close();
              await browser.close();

              retryCount++;

              // Context7推奨: より長い指数バックオフ待機
              const waitTime = Math.pow(2, retryCount) * 1500; // 1.5秒ベースに短縮
              await new Promise(r => setTimeout(r, waitTime));

              continue; // リトライループを継続
            } else {
              throw new Error(
                `最新突破技術適用でも認証ページが継続表示（${maxRetries + 1}回試行後）`
              );
            }
          }

          // 認証突破成功時の処理を継続
          const cookies = await page.cookies();
          vibeLogger.info(
            'puppeteer.cookies_captured',
            'Cookie取得成功（最新突破技術で認証突破完了）',
            {
              context: { cookieCount: cookies.length, retryCount, breakthroughTech: 'applied' },
            }
          );

          // 物件要素の取得（Context7調査: より確実なセレクタ）
          const properties: PropertyInfo[] = await page.evaluate((): PropertyInfo[] => {
            console.log('Starting property search with enhanced selectors...');
            console.log('Current URL:', window.location.href);
            console.log('Page title:', document.title);

            // Context7推奨: より広範囲なセレクタ（Web Components優先）
            const selectors = [
              // Web Components（最優先）
              'athome-csite-pc-part-rent-business-other-bukken-card',
              'athome-search-result-list-item',
              'athome-buy-other-object-list-item',
              'athome-object-item',
              // 現代的セレクタ
              '[data-testid*="property"]',
              '[data-cy*="property"]',
              '[class*="PropertyCard"]',
              '[class*="property-card"]',
              // 従来のセレクタ（強化）
              '.item-cassette',
              '.p-main-cassette-item',
              '.cassette-item',
              '[class*="bukken-card"]',
              '[class*="property"]',
              '[class*="bukken"]',
              '[class*="item"]',
              // フォールバック
              'article[class*="item"]',
              'section[class*="property"]',
              'div[class*="result-item"]',
            ];

            let foundElements: PropertyInfo[] = [];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              console.log(`Enhanced selector "${selector}": found ${elements.length} elements`);

              if (elements.length > 0) {
                // 最初の3件を取得
                const items = Array.from(elements)
                  .slice(0, 3)
                  .map((el: Element): PropertyInfo | null => {
                    const text = el.textContent ?? '';

                    // Context7推奨: より堅牢な情報抽出
                    let title = '';
                    let price = '';
                    let location = '';

                    // タイトル抽出（複数パターン対応）
                    const titleSelectors = [
                      'a[href*="bukken"]',
                      'a[href*="property"]',
                      'a',
                      '[class*="title"]',
                      '[data-testid*="title"]',
                      'h2',
                      'h3',
                      'h4',
                      '.bukken-name',
                      '.property-name',
                    ];

                    for (const titleSel of titleSelectors) {
                      const titleEl = el.querySelector(titleSel);
                      if (titleEl?.textContent?.trim()) {
                        title = titleEl.textContent.trim();
                        break;
                      }
                    }

                    // タイトルが取得できない場合の高度な代替手段
                    if (!title) {
                      const lines = text.split('\n').filter((line: string) => line.trim());
                      if (lines.length > 0) {
                        // より厳密な価格以外の判定
                        for (const line of lines) {
                          const trimmedLine = line.trim();
                          if (
                            trimmedLine.length > 5 &&
                            !trimmedLine.includes('万円') &&
                            !trimmedLine.match(/^\d+[,\d]*$/) &&
                            !trimmedLine.includes('件') &&
                            !trimmedLine.includes('㎡')
                          ) {
                            title = trimmedLine;
                            break;
                          }
                        }
                      }
                    }

                    // 価格抽出（強化版）
                    const priceSelectors = [
                      '[class*="price"]',
                      '[data-testid*="price"]',
                      '.bukken-price',
                      '.property-price',
                    ];

                    for (const priceSel of priceSelectors) {
                      const priceEl = el.querySelector(priceSel);
                      if (priceEl?.textContent?.trim()) {
                        price = priceEl.textContent.trim();
                        break;
                      }
                    }

                    if (!price) {
                      // より柔軟な価格マッチング
                      const priceMatch = text.match(
                        /[0-9,]+(?:\.[0-9]+)?万円|[0-9,]+(?:\.[0-9]+)?円/
                      );
                      price = priceMatch ? priceMatch[0] : '';
                    }

                    // 場所抽出（強化版）
                    const locationSelectors = [
                      '[class*="location"]',
                      '[class*="address"]',
                      '[data-testid*="location"]',
                      '[data-testid*="address"]',
                      '.bukken-address',
                      '.property-location',
                    ];

                    for (const locSel of locationSelectors) {
                      const locationEl = el.querySelector(locSel);
                      if (locationEl?.textContent?.trim()) {
                        location = locationEl.textContent.trim();
                        break;
                      }
                    }

                    if (!location) {
                      // より広範囲な地域マッチング
                      const locationMatch = text.match(/[都道府県市区町村][^0-9]{0,50}?[区市町村]/);
                      location = locationMatch ? locationMatch[0] : '';
                    }

                    console.log(
                      `Enhanced extraction: title="${title}", price="${price}", location="${location}"`
                    );

                    return title && price ? { title, price, location } : null;
                  })
                  .filter((item): item is PropertyInfo => item !== null);

                if (items.length > 0) {
                  foundElements = items;
                  console.log(
                    `Found ${items.length} valid items with enhanced selector "${selector}"`
                  );
                  break;
                }
              }
            }

            if (foundElements.length === 0) {
              console.log('No property elements found with enhanced selectors');
              console.log('Page HTML length:', document.body.innerHTML.length);

              // Context7推奨: Web Componentsの詳細解析
              const webComponents = Array.from(document.querySelectorAll('*')).filter(el =>
                el.tagName.includes('-')
              );
              console.log('Web Components analysis:', webComponents.length);
              if (webComponents.length > 0 && webComponents.length < 50) {
                webComponents.forEach((wc, idx) => {
                  if (idx < 10) {
                    // 最初の10件のみログ出力
                    console.log(`Web Component ${idx}: ${wc.tagName.toLowerCase()}`);
                  }
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
            vibeLogger.error(
              'puppeteer.no_properties',
              '最新技術適用でも物件要素が見つかりません',
              {
                context: {
                  url,
                  title: pageTitle,
                  htmlLength: pageContent.length,
                  finalRetryCount: retryCount,
                  breakthroughTechApplied: true,
                },
              }
            );
            throw new Error('最新突破技術適用でも物件要素が見つかりませんでした');
          }

          const hash = crypto
            .createHash('md5')
            .update(properties.map(p => `${p.title}${p.price}`).join(''))
            .digest('hex');

          const executionTime = Date.now() - startTime;

          vibeLogger.info(
            'puppeteer.success',
            'Puppeteer スクレイピング成功（Context7最新突破技術適用版）',
            {
              context: {
                url,
                executionTime,
                propertiesCount: properties.length,
                hash,
                cookies: cookies.length,
                finalRetryCount: retryCount,
                totalAttempts: retryCount + 1,
                breakthroughTechniques: 'fingerprint+stealth+natural_behavior',
              },
              humanNote: 'Trust Score 10.0 Crawlee + 8.9 Zendriver技術統合成功',
            }
          );

          return {
            success: true,
            hash,
            count: properties.length,
            properties,
            executionTime,
            memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            cookies, // Cookie情報も含める
          };
        } catch (innerError: unknown) {
          const innerErrorMessage =
            innerError instanceof Error ? innerError.message : String(innerError);

          vibeLogger.warn('puppeteer.attempt_failed', `最新技術適用試行${retryCount + 1}失敗`, {
            context: { retryCount, error: innerErrorMessage, techApplied: 'context7_breakthrough' },
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
            const waitTime = Math.pow(2, retryCount) * 1500; // 1.5秒ベースに短縮
            vibeLogger.info(
              'puppeteer.retry_wait',
              `${waitTime}ms待機後、より高度な技術でリトライ`,
              {
                context: { retryCount, waitTime, nextTechLevel: 'enhanced' },
              }
            );
            await new Promise(r => setTimeout(r, waitTime));
            continue; // リトライループを継続
          } else {
            throw innerError; // 最大リトライ数到達時は例外を再スロー
          }
        }
      } // リトライループの終了

      // ここに到達することはないはずだが、TypeScriptエラー回避のため
      throw new Error(
        '予期しないエラー: 最新突破技術でもリトライループを正常に完了できませんでした'
      );
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
        'Puppeteer スクレイピング失敗（Context7最新突破技術適用版）',
        {
          context: {
            url,
            executionTime,
            error: errorMessage,
            finalRetryCount: retryCount,
            totalAttempts: retryCount + 1,
            appliedTechniques: 'fingerprint_spoofing+stealth_evasion+natural_operations',
          },
          humanNote: '最新突破技術適用でも認証回避失敗。より高度な対策が必要',
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
