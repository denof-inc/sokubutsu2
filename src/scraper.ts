import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { ScrapingResult } from './types';
import { logger } from './logger';
import { PerformanceMonitor } from './performance';

/**
 * 軽量HTTPスクレイパー（戦略準拠）
 */
export class SimpleScraper {
  private readonly timeout = 10000; // 10秒タイムアウト
  private readonly maxRetries = 3;
  
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };

  /**
   * athome.co.jpのスクレイピング（HTTP-first戦略）
   */
  @PerformanceMonitor.measureExecutionTime
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`スクレイピング開始: ${url}`);
      
      const response = await this.fetchWithRetry(url);
      const $ = cheerio.load(response.data);
      
      // athome.co.jp専用セレクター（戦略文書で実証済み）
      const selectors = [
        '[class*="property"]',  // 実証済み: 効果的
        '[class*="bukken"]',    // 実証済み: 効果的
        '[class*="item"]',      // 実証済み: 効果的
        '.item-cassette',       // 補助的
        '.property-list-item',  // 補助的
      ];
      
      let properties: cheerio.Cheerio<cheerio.Element> | null = null;
      let usedSelector = '';
      
      // セレクターを順次試行
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          properties = elements;
          usedSelector = selector;
          logger.debug(`有効なセレクター発見: ${selector} (${elements.length}件)`);
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
      
      logger.info(`スクレイピング成功: ${count}件検出 (${executionTime}ms, セレクター: ${usedSelector})`);
      
      return {
        success: true,
        hash,
        count,
        executionTime,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`スクレイピング失敗: ${url} (${executionTime}ms)`, { error: errorMessage });
      
      return {
        success: false,
        hash: '',
        count: 0,
        error: errorMessage,
        executionTime,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
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
        validateStatus: (status) => status < 400,
      });
      
      return response;
      
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 指数バックオフ
        logger.warn(`リトライ ${retryCount + 1}/${this.maxRetries} (${delay}ms後): ${url}`);
        
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
      logger.warn('スクレイピング結果の妥当性に問題があります', result);
      return false;
    }
    
    // パフォーマンス目標チェック（実行時間: 2-5秒）
    if (result.executionTime && result.executionTime > 5000) {
      logger.warn(`実行時間が目標を超過: ${result.executionTime}ms > 5000ms`);
    }
    
    // メモリ使用量チェック（目標: 30-50MB）
    if (result.memoryUsage && result.memoryUsage > 50) {
      logger.warn(`メモリ使用量が目標を超過: ${result.memoryUsage}MB > 50MB`);
    }
    
    return true;
  }
}