import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import * as crypto from 'crypto';
import { BotProtectionService } from '../bot-protection/bot-protection.service';
import { botProtectionConfig } from '../config/bot-protection.config';

interface ScrapeResult {
  hash: string | null;
  method: 'http' | 'jsdom' | 'playwright' | 'google-playwright';
  error?: string;
}

interface ScrapeOptions {
  useGoogleSearch?: boolean;
  searchQuery?: string;
  testBotDetection?: boolean;
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(
    private readonly botProtectionService: BotProtectionService,
  ) {}

  async scrapeAndGetHash(
    url: string,
    selector: string,
    options: ScrapeOptions = {},
  ): Promise<string | null> {
    const domain = new URL(url).hostname;

    // Bot検知テストを実行（オプション）
    if (options.testBotDetection) {
      const detectionResult = await this.testBotDetection(url, selector);
      this.logger.log(`Bot detection test for ${domain}:`, detectionResult);
    }

    // Google経由アクセスが必要な場合
    if (options.useGoogleSearch && options.searchQuery) {
      try {
        await this.botProtectionService.accessViaGoogle(url, options.searchQuery);
        const result = await this.scrapeWithPlaywrightSession(url, selector);
        return result.hash;
      } catch (error) {
        this.logger.error(`Google経由アクセス失敗: ${error.message}`);
      }
    }

    // 通常の段階的スクレイピング
    const result = await this.scrapeWithStrategy(url, selector);
    
    if (result.hash) {
      this.logger.log(`[${url}] スクレイピング成功 (方法: ${result.method})`);
    } else {
      this.logger.error(`[${url}] すべてのスクレイピング手法が失敗しました`);
    }
    
    return result.hash;
  }

  private async scrapeWithStrategy(url: string, selector: string): Promise<ScrapeResult> {
    const domain = new URL(url).hostname;

    // 第1段階: HTTP + Cheerio
    try {
      this.logger.debug(`[${url}] 第1段階: HTTP + Cheerioでスクレイピング`);
      const hash = await this.scrapeWithHttp(url, selector);
      if (hash) {
        // 成功時はレート制限を緩和
        await this.botProtectionService.getAdaptiveDelay(domain, false);
        return { hash, method: 'http' };
      }
    } catch (error) {
      this.logger.warn(`[${url}] HTTP + Cheerio失敗: ${error.message}`);
      // エラー時はレート制限を強化
      await this.botProtectionService.getAdaptiveDelay(domain, true);
    }

    // 第2段階: JSDOM
    try {
      this.logger.debug(`[${url}] 第2段階: JSDOMでスクレイピング`);
      const hash = await this.scrapeWithJsdom(url, selector);
      if (hash) {
        await this.botProtectionService.getAdaptiveDelay(domain, false);
        return { hash, method: 'jsdom' };
      }
    } catch (error) {
      this.logger.warn(`[${url}] JSDOM失敗: ${error.message}`);
      await this.botProtectionService.getAdaptiveDelay(domain, true);
    }

    // 第3段階: Playwright
    try {
      this.logger.debug(`[${url}] 第3段階: Playwrightでスクレイピング`);
      const hash = await this.scrapeWithPlaywright(url, selector);
      if (hash) {
        await this.botProtectionService.getAdaptiveDelay(domain, false);
        return { hash, method: 'playwright' };
      }
    } catch (error) {
      this.logger.error(`[${url}] Playwright失敗: ${error.message}`);
      await this.botProtectionService.getAdaptiveDelay(domain, true);
    }

    return { hash: null, method: 'playwright', error: 'All methods failed' };
  }

  private async scrapeWithHttp(url: string, selector: string): Promise<string | null> {
    const userAgent = this.getRandomUserAgent();
    const domain = new URL(url).hostname;
    
    // 適応的レート制限による遅延
    const delay = await this.botProtectionService.getAdaptiveDelay(domain);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        ...botProtectionConfig.headers,
      },
      timeout: botProtectionConfig.timeouts.http,
    });

    const $ = cheerio.load(response.data);
    const element = $(selector);
    
    if (!element.length) {
      throw new Error(`セレクタ "${selector}" が見つかりませんでした`);
    }

    const content = element.html();
    if (!content) {
      throw new Error('コンテンツが空です');
    }

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async scrapeWithJsdom(url: string, selector: string): Promise<string | null> {
    const userAgent = this.getRandomUserAgent();
    const domain = new URL(url).hostname;
    
    // 適応的レート制限による遅延
    const delay = await this.botProtectionService.getAdaptiveDelay(domain);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const dom = await JSDOM.fromURL(url, {
      userAgent,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
    });

    // JavaScriptの実行を少し待つ
    await new Promise(resolve => setTimeout(resolve, 2000));

    const element = dom.window.document.querySelector(selector);
    if (!element) {
      throw new Error(`セレクタ "${selector}" が見つかりませんでした`);
    }

    const content = element.innerHTML;
    if (!content) {
      throw new Error('コンテンツが空です');
    }

    dom.window.close();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async scrapeWithPlaywright(url: string, selector: string): Promise<string | null> {
    let browser: Browser | null = null;
    const domain = new URL(url).hostname;
    
    try {
      // 適応的レート制限による遅延
      const delay = await this.botProtectionService.getAdaptiveDelay(domain);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      browser = await chromium.launch({
        headless: true,
        args: botProtectionConfig.playwrightOptions.args,
      });
      
      const page = await browser.newPage({
        userAgent: this.getRandomUserAgent(),
      });
      
      // Bot検知回避のための設定
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      });
      
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForSelector(selector, { timeout: 30000 });

      const element = await page.$(selector);
      if (!element) {
        throw new Error(`セレクタ "${selector}" が見つかりませんでした`);
      }

      const content = await element.innerHTML();
      if (!content) {
        throw new Error('コンテンツが空です');
      }
      
      return crypto.createHash('sha256').update(content).digest('hex');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Bot検知テストを実行
   */
  private async testBotDetection(url: string, selector: string): Promise<{
    httpAccessible: boolean;
    jsdomAccessible: boolean;
    playwrightAccessible: boolean;
  }> {
    const results = {
      httpAccessible: false,
      jsdomAccessible: false,
      playwrightAccessible: false,
    };

    // HTTP テスト
    try {
      await this.scrapeWithHttp(url, selector);
      results.httpAccessible = true;
    } catch (error) {
      this.logger.debug(`HTTP test failed: ${error.message}`);
    }

    // JSDOM テスト
    try {
      await this.scrapeWithJsdom(url, selector);
      results.jsdomAccessible = true;
    } catch (error) {
      this.logger.debug(`JSDOM test failed: ${error.message}`);
    }

    // Playwright テスト
    try {
      await this.scrapeWithPlaywright(url, selector);
      results.playwrightAccessible = true;
    } catch (error) {
      this.logger.debug(`Playwright test failed: ${error.message}`);
    }

    return results;
  }

  /**
   * セッション管理されたPlaywrightでスクレイピング
   */
  private async scrapeWithPlaywrightSession(url: string, selector: string): Promise<ScrapeResult> {
    const domain = new URL(url).hostname;
    
    try {
      const context = await this.botProtectionService.getOrCreateSession(domain);
      const page = await context.newPage();
      
      try {
        // Cookieを復元
        await this.botProtectionService.restoreCookies(domain);
        
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await page.waitForSelector(selector, { timeout: 30000 });

        const element = await page.$(selector);
        if (!element) {
          throw new Error(`セレクタ "${selector}" が見つかりませんでした`);
        }

        const content = await element.innerHTML();
        if (!content) {
          throw new Error('コンテンツが空です');
        }
        
        // Cookieを保存
        await this.botProtectionService.saveCookies(domain);
        
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        return { hash, method: 'google-playwright' };
        
      } finally {
        await page.close();
      }
    } catch (error) {
      this.logger.error(`Session-based Playwright失敗: ${error.message}`);
      return { hash: null, method: 'google-playwright', error: error.message };
    }
  }

  private getRandomUserAgent(): string {
    return botProtectionConfig.userAgents[Math.floor(Math.random() * botProtectionConfig.userAgents.length)];
  }
}