import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import * as crypto from 'crypto';

interface ScrapeResult {
  hash: string | null;
  method: 'http' | 'jsdom' | 'playwright';
  error?: string;
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  
  // User-Agentのリスト（Bot検知回避）
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  ];

  async scrapeAndGetHash(url: string, selector: string): Promise<string | null> {
    const result = await this.scrapeWithStrategy(url, selector);
    
    if (result.hash) {
      this.logger.log(`[${url}] スクレイピング成功 (方法: ${result.method})`);
    } else {
      this.logger.error(`[${url}] すべてのスクレイピング手法が失敗しました`);
    }
    
    return result.hash;
  }

  private async scrapeWithStrategy(url: string, selector: string): Promise<ScrapeResult> {
    // 第1段階: HTTP + Cheerio
    try {
      this.logger.debug(`[${url}] 第1段階: HTTP + Cheerioでスクレイピング`);
      const hash = await this.scrapeWithHttp(url, selector);
      if (hash) {
        return { hash, method: 'http' };
      }
    } catch (error) {
      this.logger.warn(`[${url}] HTTP + Cheerio失敗: ${error.message}`);
    }

    // 第2段階: JSDOM
    try {
      this.logger.debug(`[${url}] 第2段階: JSDOMでスクレイピング`);
      const hash = await this.scrapeWithJsdom(url, selector);
      if (hash) {
        return { hash, method: 'jsdom' };
      }
    } catch (error) {
      this.logger.warn(`[${url}] JSDOM失敗: ${error.message}`);
    }

    // 第3段階: Playwright
    try {
      this.logger.debug(`[${url}] 第3段階: Playwrightでスクレイピング`);
      const hash = await this.scrapeWithPlaywright(url, selector);
      if (hash) {
        return { hash, method: 'playwright' };
      }
    } catch (error) {
      this.logger.error(`[${url}] Playwright失敗: ${error.message}`);
    }

    return { hash: null, method: 'playwright', error: 'All methods failed' };
  }

  private async scrapeWithHttp(url: string, selector: string): Promise<string | null> {
    const userAgent = this.getRandomUserAgent();
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
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
    
    // リクエスト間隔を設ける（Bot対策）
    await this.randomDelay(500, 1500);
    
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
    
    try {
      // リクエスト間隔を設ける（Bot対策）
      await this.randomDelay(1000, 2000);
      
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
}