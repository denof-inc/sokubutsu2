import { Injectable, Logger } from '@nestjs/common';
import { ProvenGoogleAccessStrategy } from '../strategies/proven-google-access.strategy';
import { AdvancedStealthService } from '../stealth/advanced-stealth.service';
import { ScrapingResult } from '../strategies/google-access.strategy';
import { chromium } from 'playwright';
import * as crypto from 'crypto';

interface CachedResult {
  result: ScrapingResult;
  timestamp: number;
}

@Injectable()
export class UltraFastScrapingOrchestrator {
  private readonly logger = new Logger(UltraFastScrapingOrchestrator.name);
  private readonly resultCache: Map<string, CachedResult> = new Map();

  constructor(
    private readonly provenStrategy: ProvenGoogleAccessStrategy,
    private readonly advancedStealth: AdvancedStealthService,
  ) {}

  async executeUltraFast(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(url);

    // Phase 1: キャッシュチェック（即座）
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult && !this.isCacheExpired(cachedResult)) {
      this.logger.debug(`Cache hit for ${url}`);
      return cachedResult.result;
    }

    // Phase 2: 超高速並列実行（5秒以内）
    const fastPromises = [
      this.executeWithTimeout(() => this.tryDirectAccess(url), 3000),
      this.executeWithTimeout(() => this.tryLightweightScraping(url), 4000),
      this.executeWithTimeout(() => this.tryCachedProxy(url), 2000),
    ];

    try {
      const fastResult = await this.raceWithFirstSuccess(fastPromises);
      if (fastResult.success) {
        this.cacheResult(cacheKey, fastResult);
        this.logPerformance('ultra-fast', startTime, fastResult);
        return fastResult;
      }
    } catch (error) {
      this.logger.debug(
        `Fast strategies failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Phase 3: 実証済みGoogle経由（15秒以内）
    try {
      const provenResult = await this.executeWithTimeout(
        () => this.executeProvenGoogleAccess(url),
        15000,
      );

      if (provenResult.success) {
        this.cacheResult(cacheKey, provenResult);
        this.logPerformance('proven-google', startTime, provenResult);
        return provenResult;
      }
    } catch (error) {
      this.logger.warn(
        `Proven Google access failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Phase 4: 高度ステルス（25秒以内）
    try {
      const stealthResult = await this.executeWithTimeout(
        () => this.executeAdvancedStealth(url),
        25000,
      );

      if (stealthResult.success) {
        this.cacheResult(cacheKey, stealthResult);
        this.logPerformance('advanced-stealth', startTime, stealthResult);
        return stealthResult;
      }
    } catch (error) {
      this.logger.warn(
        `Advanced stealth failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 全て失敗
    const totalTime = Date.now() - startTime;
    return {
      success: false,
      method: 'ultra-fast-orchestrator',
      executionTime: totalTime,
      error: `All strategies failed after ${String(totalTime)}ms`,
    };
  }

  private async executeProvenGoogleAccess(
    url: string,
  ): Promise<ScrapingResult> {
    this.logger.debug(`Executing proven Google access for: ${url}`);

    // 実証済みパターンの厳密な実装
    const browser = await chromium.launch({
      headless: false, // 成功例と同じ
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--disable-default-apps',
      ],
    });

    try {
      const page = await browser.newPage();

      // 成功例と同じ設定
      await page.setExtraHTTPHeaders({
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      await page.setViewportSize({ width: 1366, height: 768 });

      // 高度ステルス設定
      await this.advancedStealth.setupUltimateStealthMode(page);

      // 成功例の厳密な再現
      await page.goto('https://bot.sannysoft.com', {
        waitUntil: 'networkidle',
        timeout: 10000,
      });

      // 重要: 成功例と同じ3秒待機
      await new Promise((r) => setTimeout(r, 3000));

      await page.goto('https://www.google.com', {
        waitUntil: 'networkidle',
        timeout: 10000,
      });

      // 成功例と同じ400ms待機
      await new Promise((r) => setTimeout(r, 400));

      // 自然な行動パターン
      await this.advancedStealth.simulateNaturalBehavior(page);

      // 目的サイトへ
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // CAPTCHA検出
      if (page.url().includes('/sorry/') || page.url().includes('captcha')) {
        throw new Error('CAPTCHA detected');
      }

      const content = await page.content();

      return {
        success: true,
        content,
        method: 'proven-google-access',
        executionTime: Date.now(),
        metadata: {
          pattern: 'bot.sannysoft.com → Google → target',
          finalUrl: page.url(),
        },
      };
    } finally {
      await browser.close();
    }
  }

  private async tryDirectAccess(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }

      const content = await response.text();

      return {
        success: true,
        content,
        method: 'direct-fetch',
        executionTime: Date.now() - startTime,
        metadata: { finalUrl: url },
      };
    } catch (error) {
      return {
        success: false,
        method: 'direct-fetch',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async tryLightweightScraping(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    // 軽量スクレイピング実装（簡略版）
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-javascript',
        ],
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 4000 });
      const content = await page.content();
      await browser.close();

      return {
        success: true,
        content,
        method: 'lightweight-scraping',
        executionTime: Date.now() - startTime,
        metadata: { finalUrl: page.url() },
      };
    } catch (error) {
      return {
        success: false,
        method: 'lightweight-scraping',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async tryCachedProxy(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    // キャッシュプロキシ経由（Google Cache等）
    try {
      const googleCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
      const response = await fetch(googleCacheUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      });

      if (!response.ok) {
        throw new Error(`Cache not available`);
      }

      const content = await response.text();

      return {
        success: true,
        content,
        method: 'cached-proxy',
        executionTime: Date.now() - startTime,
        metadata: {
          finalUrl: googleCacheUrl,
          originalUrl: url,
        },
      };
    } catch (error) {
      return {
        success: false,
        method: 'cached-proxy',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async executeAdvancedStealth(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await this.advancedStealth.setupUltimateStealthMode(page);

      // 直接アクセス（Google経由を避ける）
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });

      await this.advancedStealth.simulateNaturalBehavior(page);

      const content = await page.content();

      return {
        success: true,
        content,
        method: 'advanced-stealth',
        executionTime: Date.now() - startTime,
        metadata: { finalUrl: page.url() },
      };
    } catch (error) {
      return {
        success: false,
        method: 'advanced-stealth',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      await browser.close();
    }
  }

  private async raceWithFirstSuccess(
    promises: Promise<ScrapingResult>[],
  ): Promise<ScrapingResult> {
    return new Promise((resolve, reject) => {
      let completed = 0;
      const errors: Error[] = [];

      promises.forEach((promise) => {
        promise
          .then((result) => {
            if (result.success) {
              resolve(result);
            } else {
              completed++;
              if (completed === promises.length) {
                reject(new Error('All fast strategies failed'));
              }
            }
          })
          .catch((error: unknown) => {
            errors.push(
              error instanceof Error ? error : new Error(String(error)),
            );
            completed++;
            if (completed === promises.length) {
              reject(
                new Error(
                  `All fast strategies failed: ${errors.map((e) => e.message).join(', ')}`,
                ),
              );
            }
          });
      });
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${String(timeoutMs)}ms`));
        }, timeoutMs),
      ),
    ]);
  }

  private generateCacheKey(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  private isCacheExpired(cached: CachedResult): boolean {
    return Date.now() - cached.timestamp > 300000; // 5分
  }

  private cacheResult(key: string, result: ScrapingResult): void {
    this.resultCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  private logPerformance(
    phase: string,
    startTime: number,
    _result: ScrapingResult,
  ): void {
    const executionTime = Date.now() - startTime;
    this.logger.debug(`${phase} completed in ${String(executionTime)}ms`);
  }
}
