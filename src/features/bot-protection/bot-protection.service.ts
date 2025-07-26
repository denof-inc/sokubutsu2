import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Browser, BrowserContext, chromium, Cookie, Page } from 'playwright';
import { botProtectionConfig } from '../../core/config/bot-protection.config';
import { BrowserStealthService } from '../scraping/browser-stealth.service';

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
export class BotProtectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotProtectionService.name);
  private browser: Browser | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private rateLimits: Map<string, RateLimitData> = new Map();

  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分
  private readonly MAX_ERROR_COUNT = 5;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 60000; // 最大1分

  constructor(private readonly browserStealthService: BrowserStealthService) {}

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
  async accessViaGoogle(
    targetUrl: string,
    searchQuery: string,
  ): Promise<boolean> {
    const domain = new URL(targetUrl).hostname;
    const context = await this.getOrCreateSession(domain);
    const page = await context.newPage();

    try {
      // Step 1: Bot検知テストサイトへのアクセス
      await page.goto('https://bot.sannysoft.com', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Step 2: 3秒間の待機（重要：この待機時間は必須）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 3: Googleへのアクセス
      await page.goto('https://www.google.com', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Step 4: 検索実行
      // Googleの検索ボックスを複数のセレクタで試行
      let searchBox;
      try {
        searchBox = await page.waitForSelector('input[name="q"]', {
          timeout: 5000,
        });
      } catch {
        // 別のセレクタを試行
        searchBox = await page.waitForSelector('textarea[name="q"]', {
          timeout: 5000,
        });
      }

      await searchBox.type(searchQuery, { delay: 100 });
      await searchBox.press('Enter');

      // Step 5: 検索結果の待機
      await page.waitForSelector('#search', { timeout: 15000 });

      // Step 6: 目的サイトのリンクを探してクリック
      const targetDomain = new URL(targetUrl).hostname;
      const links = await page.$$eval(
        'a[href]',
        (elements, domain) => {
          return elements
            .filter((el) => (el as HTMLAnchorElement).href.includes(domain))
            .map((el) => ({
              href: (el as HTMLAnchorElement).href,
              text: el.textContent,
            }));
        },
        targetDomain,
      );

      if (links.length === 0) {
        throw new Error(`No links found for domain: ${targetDomain}`);
      }

      // Step 7: 最初のリンクをクリック
      await page.click(`a[href*="${targetDomain}"]`);
      await page.waitForLoadState('networkidle');

      this.logger.log(`Successfully accessed ${targetUrl} via Google`);
      return true;
    } catch (error) {
      this.logger.error(`Google経由アクセス失敗: ${error.message}`);
      return false;
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
  async getAdaptiveDelay(
    domain: string,
    isError: boolean = false,
  ): Promise<number> {
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
        this.MAX_DELAY_MS,
      );

      this.logger.warn(
        `Rate limit increased for ${domain}: ${rateLimit.currentDelay}ms`,
      );
    } else {
      // 成功時は徐々にディレイを減少
      const timeSinceLastError = Date.now() - rateLimit.lastErrorTime.getTime();

      if (timeSinceLastError > 5 * 60 * 1000) {
        // 5分以上エラーなし
        rateLimit.errorCount = Math.max(0, rateLimit.errorCount - 1);
        rateLimit.currentDelay = Math.max(
          this.BASE_DELAY_MS,
          rateLimit.currentDelay * 0.8,
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
      this.logger.debug(
        `Saved ${session.cookies.length} cookies for ${domain}`,
      );
    }
  }

  async restoreCookies(domain: string): Promise<void> {
    const session = this.sessions.get(domain);
    if (session && session.cookies.length > 0) {
      await session.context.addCookies(session.cookies);
      this.logger.debug(
        `Restored ${session.cookies.length} cookies for ${domain}`,
      );
    }
  }

  private getRandomUserAgent(): string {
    const userAgents = botProtectionConfig.userAgents;
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private async humanDelay(): Promise<void> {
    const delay = 500 + Math.random() * 2000; // 0.5〜2.5秒
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private getRandomTypingDelay(): number {
    return 50 + Math.random() * 150; // 50〜200ms/文字
  }

  /**
   * 高度なBot対策を実行
   */
  async performAdvancedBotProtection(
    page: Page,
    targetUrl: string,
  ): Promise<boolean> {
    try {
      // Step 1: ブラウザステルス機能の適用
      await this.browserStealthService.applyStealthMeasures(page);

      // Step 2: 段階的なサイトアクセス
      const success = await this.graduatedAccess(page, targetUrl);

      if (!success) {
        // Step 3: Google経由アクセスの実行
        return await this.accessViaGoogle(
          targetUrl,
          this.generateSearchQuery(targetUrl),
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`高度なBot対策実行失敗: ${error.message}`);
      return false;
    }
  }

  private async graduatedAccess(
    page: Page,
    targetUrl: string,
  ): Promise<boolean> {
    const domain = new URL(targetUrl).hostname;

    try {
      // Step 1: ドメインのトップページにアクセス
      const topPageUrl = `https://${domain}`;
      await page.goto(topPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.browserStealthService.simulateHumanInteraction(page);

      // Step 2: サイト内の別ページにアクセス
      const internalLinks = await page.$$eval(
        'a[href]',
        (links, currentDomain) => {
          return links
            .filter((link) => {
              const href = (link as HTMLAnchorElement).href;
              return (
                href.includes(currentDomain) && href !== window.location.href
              );
            })
            .slice(0, 3)
            .map((link) => (link as HTMLAnchorElement).href);
        },
        domain,
      );

      if (internalLinks.length > 0) {
        const randomLink =
          internalLinks[Math.floor(Math.random() * internalLinks.length)];
        await page.goto(randomLink, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        await this.browserStealthService.simulateHumanInteraction(page);
      }

      // Step 3: 目的のページにアクセス
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

      return true;
    } catch (error) {
      this.logger.warn(`段階的アクセス失敗: ${error.message}`);
      return false;
    }
  }

  private generateSearchQuery(targetUrl: string): string {
    const domain = new URL(targetUrl).hostname;

    const siteQueries: { [key: string]: string } = {
      'athome.co.jp': 'アットホーム 賃貸 物件検索',
      'suumo.jp': 'SUUMO スーモ 不動産',
      'homes.co.jp': 'ホームズ 賃貸 マンション',
      'chintai.mynavi.jp': 'マイナビ賃貸 物件情報',
    };

    return siteQueries[domain] || `${domain} 不動産 物件`;
  }
}
