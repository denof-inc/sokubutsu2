import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { ScrapingResult } from './types';
import { vibeLogger } from './logger';

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

  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
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

      // athome.co.jp専用セレクター（戦略文書で実証済み）
      const selectors = [
        '[class*="property"]', // 実証済み: 効果的
        '[class*="bukken"]', // 実証済み: 効果的
        '[class*="item"]', // 実証済み: 効果的
        '.item-cassette', // 補助的
        '.property-list-item', // 補助的
      ];

      let properties: ReturnType<typeof $> | null = null;
      let usedSelector = '';

      // セレクターを順次試行
      for (const selector of selectors) {
        const elements = $(selector);
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
        throw new Error('物件要素が見つかりませんでした');
      }

      const count = properties.length;
      const contentText = properties.text();
      const hash = crypto.createHash('md5').update(contentText).digest('hex');
      const executionTime = Date.now() - startTime;

      vibeLogger.info('scraping.success', `スクレイピング成功: ${count}件検出`, {
        context: {
          url,
          count,
          executionTime,
          selector: usedSelector,
          hash,
          memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        },
        humanNote: 'パフォーマンス目標: 2-5秒、メモリ30-50MB',
        aiTodo: '実行時間とメモリ使用量を分析し、最適化案を提案',
      });

      return {
        success: true,
        hash,
        count,
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
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: status => status < 400,
      });

      return response;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 指数バックオフ
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
