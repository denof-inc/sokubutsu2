import { Injectable, Logger } from '@nestjs/common';
import { Browser, BrowserContext, chromium, Cookie } from 'playwright';
import { botProtectionConfig } from '../config/bot-protection.config';

interface SessionData {
  context: BrowserContext;
  cookies: Cookie[];
  lastAccessTime: Date;
  errorCount: number;
  domain: string;
}

interface RateLimitData {
  domain: string;
  errorCount: number;
  lastErrorTime: Date;
  currentDelay: number;
}

@Injectable()
export class BotProtectionService {
  private readonly logger = new Logger(BotProtectionService.name);
  private browser: Browser | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private rateLimits: Map<string, RateLimitData> = new Map();
  
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分
  private readonly MAX_ERROR_COUNT = 5;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 60000; // 最大1分

  async onModuleInit() {
    await this.initializeBrowser();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async initializeBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: botProtectionConfig.playwrightOptions.args,
      });
      this.logger.log('Browser initialized');
    }
  }

  private async cleanup() {
    // すべてのセッションをクリーンアップ
    for (const [domain, session] of this.sessions.entries()) {
      await session.context.close();
    }
    this.sessions.clear();

    // ブラウザをクローズ
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * ドメイン用のセッションを取得または作成
   */
  async getOrCreateSession(domain: string): Promise<BrowserContext> {
    // 既存のセッションをチェック
    const existingSession = this.sessions.get(domain);
    
    if (existingSession) {
      const sessionAge = Date.now() - existingSession.lastAccessTime.getTime();
      
      // セッションタイムアウトチェック
      if (sessionAge < this.SESSION_TIMEOUT_MS) {
        existingSession.lastAccessTime = new Date();
        return existingSession.context;
      } else {
        this.logger.warn(`Session timeout for ${domain}, creating new session`);
        await existingSession.context.close();
        this.sessions.delete(domain);
      }
    }

    // 新しいセッションを作成
    return await this.createNewSession(domain);
  }

  private async createNewSession(domain: string): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const context = await this.browser!.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });

    const sessionData: SessionData = {
      context,
      cookies: [],
      lastAccessTime: new Date(),
      errorCount: 0,
      domain,
    };

    this.sessions.set(domain, sessionData);
    this.logger.log(`New session created for ${domain}`);
    
    return context;
  }

  /**
   * Google経由でサイトにアクセス
   */
  async accessViaGoogle(targetUrl: string, searchQuery: string): Promise<void> {
    const domain = new URL(targetUrl).hostname;
    const context = await this.getOrCreateSession(domain);
    const page = await context.newPage();

    try {
      // Google検索ページにアクセス
      await page.goto('https://www.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // 人間らしい遅延
      await this.humanDelay();

      // 検索ボックスに入力
      const searchBox = await page.locator('input[name="q"]');
      await searchBox.click();
      await searchBox.type(searchQuery, { delay: this.getRandomTypingDelay() });

      // 検索実行
      await this.humanDelay();
      await page.keyboard.press('Enter');

      // 検索結果を待つ
      await page.waitForSelector('#search', { timeout: 10000 });
      await this.humanDelay();

      // 目的のサイトへのリンクを探してクリック
      const targetLink = await page.locator(`a[href*="${domain}"]`).first();
      if (await targetLink.isVisible()) {
        await targetLink.click();
        await page.waitForLoadState('domcontentloaded');
        this.logger.log(`Successfully accessed ${targetUrl} via Google`);
      } else {
        throw new Error(`Could not find link to ${domain} in search results`);
      }

    } catch (error) {
      this.logger.error(`Failed to access ${targetUrl} via Google: ${error.message}`);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Bot検知テスト（3段階）
   */
  async testBotDetection(url: string): Promise<{
    httpAccessible: boolean;
    jsdomAccessible: boolean;
    playwrightAccessible: boolean;
  }> {
    const results = {
      httpAccessible: false,
      jsdomAccessible: false,
      playwrightAccessible: false,
    };

    // この部分はScrapingServiceと連携して実装
    // 各手法でアクセスを試み、成功/失敗を記録
    
    return results;
  }

  /**
   * レート制限の取得と更新
   */
  async getAdaptiveDelay(domain: string, isError: boolean = false): Promise<number> {
    const rateLimit = this.rateLimits.get(domain) || {
      domain,
      errorCount: 0,
      lastErrorTime: new Date(0),
      currentDelay: this.BASE_DELAY_MS,
    };

    if (isError) {
      // エラーカウントを増加
      rateLimit.errorCount++;
      rateLimit.lastErrorTime = new Date();
      
      // 指数関数的にディレイを増加
      rateLimit.currentDelay = Math.min(
        this.BASE_DELAY_MS * Math.pow(2, rateLimit.errorCount),
        this.MAX_DELAY_MS
      );
      
      this.logger.warn(`Rate limit increased for ${domain}: ${rateLimit.currentDelay}ms`);
    } else {
      // 成功時は徐々にディレイを減少
      const timeSinceLastError = Date.now() - rateLimit.lastErrorTime.getTime();
      
      if (timeSinceLastError > 5 * 60 * 1000) { // 5分以上エラーなし
        rateLimit.errorCount = Math.max(0, rateLimit.errorCount - 1);
        rateLimit.currentDelay = Math.max(
          this.BASE_DELAY_MS,
          rateLimit.currentDelay * 0.8
        );
      }
    }

    this.rateLimits.set(domain, rateLimit);
    
    // ランダム性を追加
    const jitter = rateLimit.currentDelay * 0.2;
    return rateLimit.currentDelay + (Math.random() - 0.5) * jitter;
  }

  /**
   * Cookieの保存と復元
   */
  async saveCookies(domain: string): Promise<void> {
    const session = this.sessions.get(domain);
    if (session) {
      session.cookies = await session.context.cookies();
      this.logger.debug(`Saved ${session.cookies.length} cookies for ${domain}`);
    }
  }

  async restoreCookies(domain: string): Promise<void> {
    const session = this.sessions.get(domain);
    if (session && session.cookies.length > 0) {
      await session.context.addCookies(session.cookies);
      this.logger.debug(`Restored ${session.cookies.length} cookies for ${domain}`);
    }
  }

  private getRandomUserAgent(): string {
    const userAgents = botProtectionConfig.userAgents;
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private async humanDelay(): Promise<void> {
    const delay = 500 + Math.random() * 2000; // 0.5〜2.5秒
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getRandomTypingDelay(): number {
    return 50 + Math.random() * 150; // 50〜200ms/文字
  }
}