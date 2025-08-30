import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { ScrapingResult } from './types.js';
import { vibeLogger } from './logger.js';
import { PuppeteerScraper } from './scraper-puppeteer.js';
import { config } from './config.js';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { sessionManager } from './utils/session-manager.js';

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
  private readonly timeout = config.monitoring.httpTimeoutMs; // 設定可能なHTTPタイムアウト
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
   * athome.co.jpのスクレイピング（段階的フォールバック戦略）
   * 1. HTTP-first (axios + cheerio)
   * 2. Puppeteer + Stealth Plugin
   * 3. Puppeteer Real Browser
   */
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      // 持続セッションが有効なら、まず軽量reloadで取得を試みる
      if (config.scraping?.persistentSessionEnabled) {
        try {
          const { html, authDetected } = await sessionManager.reloadAndGetContent(url);
          if (!authDetected && html) {
            const result = this.extractFromHtml(html);
            if (result.count > 0) {
              const exec = Date.now() - startTime;
              vibeLogger.info(
                'scraping.success.persistent',
                '持続セッションでのスクレイピング成功',
                {
                  context: { url, propertiesCount: result.count, executionTime: exec },
                }
              );
              return { success: true, hash: result.hash, count: result.count, executionTime: exec };
            }
          }
          // 認証検出または抽出失敗時はPuppeteerにフォールバック
          vibeLogger.warn(
            'scraping.persistent_fallback',
            '持続セッションで抽出できず、Puppeteerへフォールバック',
            {
              context: { url },
            }
          );
        } catch (e) {
          vibeLogger.warn(
            'scraping.persistent_error',
            '持続セッションでの取得に失敗。フォールバック実施',
            {
              context: { url, error: e instanceof Error ? e.message : String(e) },
            }
          );
        }
      }

      // Puppeteer-only戦略（HTTP-firstフォールバック削除）
      vibeLogger.info('scraping.start', `Puppeteer単体スクレイピング開始: ${url}`, {
        context: { url, method: 'Puppeteer-only' },
        humanNote: 'Context7最新技術適用でPuppeteer単体実行。HTTP-firstフォールバック削除済み',
      });

      this.puppeteerScraper ??= new PuppeteerScraper();

      // Puppeteer単体で実行（認証突破に特化）
      const result = await this.puppeteerScraper.scrapeAthome(url);

      if (result.success) {
        vibeLogger.info('scraping.success', 'Puppeteer単体スクレイピング成功', {
          context: {
            url,
            executionTime: result.executionTime,
            propertiesCount: result.count,
            hash: result.hash,
            memoryUsage: result.memoryUsage,
          },
          humanNote: 'Context7最新突破技術で認証回避成功',
        });
      } else {
        vibeLogger.error('scraping.failed', 'Puppeteer単体スクレイピング失敗', {
          context: {
            url,
            executionTime: result.executionTime,
            error: result.error,
            failureReason: result.failureReason,
          },
          humanNote: '最新技術適用でも失敗。より高度な対策が必要',
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      vibeLogger.error('scraping.failed', `Puppeteer単体スクレイピング例外: ${url}`, {
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
        humanNote: 'Puppeteer初期化またはセットアップエラー',
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
   * HTMLから物件の存在を簡易判定し、プロパティ数とハッシュを算出
   */
  private extractFromHtml(html: string): { count: number; hash: string } {
    try {
      const $ = cheerio.load(html);
      // セレクタ群（サイト構造に応じて拡張）
      const selectors = [
        'athome-search-result-list-item',
        'athome-buy-other-object-list-item',
        '[class*="bukken"]',
        '[class*="property-list"]',
        '.item-cassette',
      ];
      let items: string[] = [];
      for (const sel of selectors) {
        const nodes = $(sel);
        if (nodes.length > 0) {
          items = nodes
            .slice(0, 20)
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(Boolean);
          if (items.length > 0) break;
        }
      }
      // 最低限のハッシュ（テキストベース）
      const hash = crypto.createHash('md5').update(items.join('|')).digest('hex');
      return { count: items.length, hash };
    } catch {
      return { count: 0, hash: '' };
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
          Referer: 'https://www.athome.co.jp/',
          // Cookieがあれば追加
          ...(this.cookieJar ? { Cookie: this.cookieJar } : {}),
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
