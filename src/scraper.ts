import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { ScrapingResult, PropertyInfo } from './types.js';
import { vibeLogger } from './logger.js';
import { PuppeteerScraper } from './scraper-puppeteer.js';

/**
 * 軽量HTTPスクレイパー（戦略準拠）
 *
 * @設計ドキュメント
 * - README.md: HTTPファースト戦略の詳細
 * - docs/スクレイピング戦略ルール.md: athome.co.jp特別ルール
 *
 * @関連クラス
 * - MonitoringScheduler: このクラスのスクレイピング機能を呼び出す
 * - SimpleStorage: スクレイピング結果のハッシュ保存で連携
 * - Logger: エラーログ・情報ログの出力で使用
 *
 * @主要機能
 * - HTTP-onlyによる軽量スクレイピング（2-5秒）
 * - athome.co.jp専用セレクター実装
 * - リトライ機能付きHTTPリクエスト
 */
export class SimpleScraper {
  private readonly timeout = 10000; // 10秒タイムアウト
  private readonly maxRetries = 3;
  private puppeteerScraper: PuppeteerScraper | null = null;
  private cookieJar: string = ''; // Cookieを保持

  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };

  /**
   * athome.co.jpのスクレイピング（HTTP-first戦略）
   */
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      vibeLogger.info('scraping.start', `スクレイピング開始: ${url}`, {
        context: { url, method: 'HTTP-first', timeout: this.timeout },
        humanNote: 'HTTP-first戦略による軽量スクレイピング',
      });

      const response = await this.fetchWithRetry(url);
      const $ = cheerio.load(response.data);

      // 認証ページが返された場合のチェック
      const title = $('title').text();
      if (title.includes('認証') || $('body').text().includes('認証にご協力ください')) {
        vibeLogger.warn('scraping.auth_required', '認証ページが検出されました。Puppeteerにフォールバック', {
          context: { url, title },
          humanNote: 'HTTP-first戦略失敗。段階的フォールバックを実行',
        });

        // Puppeteerへフォールバック
        if (!this.puppeteerScraper) {
          this.puppeteerScraper = new PuppeteerScraper();
        }
        
        return await this.puppeteerScraper.scrapeAthome(url);
      }

      // athome.co.jp専用セレクター（戦略文書で実証済み）
      const selectors = [
        'athome-search-result-list-item', // カスタム要素の可能性（最優先）
        'athome-buy-other-object-list-item', // 売買物件リスト要素
        'athome-object-item', // 物件要素
        '[class*="property"]', // 実証済み: 効果的
        '[class*="bukken"]', // 実証済み: 効果的
        '[class*="item"]', // 実証済み: 効果的
        '.item-cassette', // 補助的
        '.property-list-item', // 補助的
        '[class*="object"]', // object関連クラス
        '[class*="list-item"]', // list-item関連クラス
        'div[class*="result"]', // result関連クラス
        'article', // 記事要素
        'section[class*="list"]', // セクション要素
        // 追加の可能性
        '.search-result-list > *', // 検索結果リストの子要素
        '.result-list > *', // 結果リストの子要素
        '[data-item]', // data属性を持つ要素
        '[data-property]', // data属性を持つ要素
      ];

      let properties: ReturnType<typeof $> | null = null;
      let usedSelector = '';

      // セレクターを順次試行
      vibeLogger.debug('scraping.selector.search', 'セレクター検索開始', {
        context: { totalSelectors: selectors.length },
      });

      for (const selector of selectors) {
        const elements = $(selector);
        vibeLogger.debug('scraping.selector.test', `セレクターテスト: ${selector}`, {
          context: { selector, count: elements.length },
        });

        if (elements.length > 0) {
          properties = elements;
          usedSelector = selector;
          vibeLogger.debug(
            'scraping.selector.found',
            `有効なセレクター発見: ${selector} (${elements.length}件)`,
            {
              context: { selector, count: elements.length },
            }
          );
          break;
        }
      }

      if (!properties || properties.length === 0) {
        // デバッグ情報を出力
        vibeLogger.debug('scraping.selector.not_found', 'セレクターが見つかりません', {
          context: {
            url,
            htmlLength: response.data.length,
            titleTag: $('title').text(),
            bodyText: $('body').text().substring(0, 200), // 最初の200文字
          },
        });

        // より広範なセレクターで再検索
        const allDivs = $('div');
        vibeLogger.debug('scraping.debug.divs', `全div要素数: ${allDivs.length}`, {
          context: {
            totalDivs: allDivs.length,
            // class属性を持つdivの数
            divsWithClass: allDivs.filter((i, el) => !!$(el).attr('class')).length,
          },
        });

        throw new Error('物件要素が見つかりませんでした');
      }

      const count = properties.length;
      const contentText = properties.text();
      const hash = crypto.createHash('md5').update(contentText).digest('hex');
      const executionTime = Date.now() - startTime;

      // ページ内の件数表示を探す
      const bodyText = $('body').text();
      const countMatches = bodyText.match(/(\d+)件/g);
      if (countMatches && countMatches.length > 0) {
        vibeLogger.info('scraping.page_info', 'ページ内の件数情報', {
          context: {
            foundCounts: countMatches,
            detectedCount: count,
            selector: usedSelector,
          },
        });
      }

      // 物件詳細情報を抽出
      const propertyInfoList: PropertyInfo[] = [];
      properties.each((index, element) => {
        if (index < 3) {
          // 最新3件のみ
          const $el = $(element);
          const elementText = $el.text();

          // ページ件数表示（「337件」など）をスキップ
          if (elementText.match(/^\d+件$/)) {
            return;
          }

          // 物件情報の抽出（athome.co.jpの実際の構造に基づく）
          const title =
            $el.find('a').first().text().trim() ||
            $el.find('[class*="title"], h2, h3').first().text().trim() ||
            elementText.split('\n')[0]?.trim() ||
            '';

          // 価格の抽出（より具体的なパターン）
          const price =
            elementText.match(/[0-9,]+万円/)?.[0] ||
            $el.find('[class*="price"]').text().trim() ||
            '';

          // 所在地の抽出
          const location =
            $el.find('[class*="location"], [class*="address"]').text().trim() ||
            elementText.match(/広島[市県][\s\S]+?[区町]/)?.[0] ||
            '';

          if (title && price) {
            const propertyInfo: PropertyInfo = {
              title,
              price,
              ...(location ? { location } : {}),
            };
            propertyInfoList.push(propertyInfo);
          }
        }
      });

      vibeLogger.info('scraping.success', `スクレイピング成功: ${count}件検出`, {
        context: {
          url,
          count,
          executionTime,
          selector: usedSelector,
          hash,
          memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          propertiesFound: propertyInfoList.length,
        },
        humanNote: 'パフォーマンス目標: 2-5秒、メモリ30-50MB',
        aiTodo: '実行時間とメモリ使用量を分析し、最適化案を提案',
      });

      return {
        success: true,
        hash,
        count,
        properties: propertyInfoList,
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      vibeLogger.error('scraping.failed', `スクレイピング失敗: ${url}`, {
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
        aiTodo: 'エラーパターンを分析し、リカバリー戦略を提案',
      });

      return {
        success: false,
        hash: '',
        count: 0,
        error: errorMessage,
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      };
    }
  }

  /**
   * リトライ機能付きHTTPリクエスト
   */
  private async fetchWithRetry(url: string, retryCount = 0): Promise<AxiosResponse<string>> {
    try {
      // 初回アクセス時はランダムな遅延を入れる
      if (retryCount === 0) {
        const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5秒の遅延
        await this.sleep(delay);
      }

      // リクエスト設定
      const config: AxiosRequestConfig = {
        headers: {
          ...this.headers,
          // リファラーを設定（athome.co.jpのトップページ）
          'Referer': 'https://www.athome.co.jp/',
          // Cookieがあれば追加
          ...(this.cookieJar ? { 'Cookie': this.cookieJar } : {}),
        },
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: status => status < 400,
      };

      const response = await axios.get(url, config);

      // レスポンスからCookieを保存
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        this.cookieJar = setCookieHeader.join('; ');
        vibeLogger.debug('http.cookie.saved', 'Cookieを保存しました', {
          context: { cookieCount: setCookieHeader.length },
        });
      }

      return response;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 2000; // 指数バックオフ（より長い間隔）
        vibeLogger.warn('http.retry', `リトライ ${retryCount + 1}/${this.maxRetries}`, {
          context: { url, retryCount, maxRetries: this.maxRetries, delay },
          humanNote: 'リトライパターンを監視し、サーバー負荷を考慮',
        });

        await this.sleep(delay);
        return this.fetchWithRetry(url, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * スクレイピング結果の妥当性検証
   */
  validateResult(result: ScrapingResult): boolean {
    if (!result.success) {
      return false;
    }

    // 基本的な妥当性チェック
    if (!result.hash || result.count < 0) {
      vibeLogger.warn('validation.invalid_result', 'スクレイピング結果の妥当性に問題があります', {
        context: { result },
        aiTodo: '無効な結果のパターンを分析',
      });
      return false;
    }

    // パフォーマンス目標チェック（実行時間: 2-5秒）
    if (result.executionTime && result.executionTime > 5000) {
      vibeLogger.warn('performance.execution_time_exceeded', `実行時間が目標を超過`, {
        context: {
          executionTime: result.executionTime,
          target: 5000,
          exceeded: result.executionTime - 5000,
        },
        humanNote: '最適化が必要な可能性があります',
      });
    }

    // メモリ使用量チェック（目標: 30-50MB）
    if (result.memoryUsage && result.memoryUsage > 50) {
      vibeLogger.warn('performance.memory_exceeded', `メモリ使用量が目標を超過`, {
        context: {
          memoryUsage: result.memoryUsage,
          target: 50,
          exceeded: result.memoryUsage - 50,
        },
        humanNote: 'メモリ最適化が必要な可能性があります',
      });
    }

    return true;
  }
}
