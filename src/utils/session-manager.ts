import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'puppeteer';
import { vibeLogger } from '../logger.js';
import { config } from '../config.js';

puppeteer.use(StealthPlugin());

type SessionState = {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  createdAt?: number;
  consecutiveAuth: number;
};

class SessionManager {
  private state: SessionState = { consecutiveAuth: 0 };

  private get ttlMs(): number {
    const minutes = config.scraping?.sessionTtlMinutes ?? 120;
    return Math.max(1, minutes) * 60 * 1000;
  }

  private get maxAuth(): number {
    return Math.max(1, config.scraping?.maxConsecutiveAuth ?? 2);
  }

  private shouldBlockMedia(): boolean {
    return !!config.scraping?.blockMediaResources;
  }

  private async ensureSession(warmupUrl: string): Promise<Page> {
    const now = Date.now();
    const expired = this.state.createdAt ? now - this.state.createdAt > this.ttlMs : true;
    const missing = !this.state.browser || !this.state.context || !this.state.page;

    if (missing || expired) {
      await this.recreateSession(warmupUrl);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.state.page!;
  }

  private async recreateSession(warmupUrl: string): Promise<void> {
    await this.destroy().catch(() => undefined);
    this.state = { consecutiveAuth: 0 };

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
      ],
      protocolTimeout: 120000,
    });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    if (this.shouldBlockMedia()) {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const rtype = req.resourceType();
        if (rtype === 'image' || rtype === 'media' || rtype === 'font') {
          void req.abort();
          return;
        }
        const url = req.url();
        if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(url)) {
          void req.abort();
          return;
        }
        void req.continue();
      });
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // 軽いウォームアップ
    try {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      vibeLogger.debug('session.warmup.google_failed', 'Googleウォームアップ失敗', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }
    try {
      await page.goto(warmupUrl, { waitUntil: 'domcontentloaded' });
    } catch (e) {
      vibeLogger.debug('session.warmup.target_failed', '対象URLウォームアップ失敗', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    this.state.browser = browser;
    this.state.context = context;
    this.state.page = page;
    this.state.createdAt = Date.now();

    vibeLogger.info('session.created', '持続セッションを作成しました', {
      context: { ttlMinutes: this.ttlMs / 60000 },
    });
  }

  private async softHumanize(page: Page): Promise<void> {
    try {
      await page.evaluate(() => window.scrollTo(0, 200));
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      vibeLogger.debug('session.humanize_failed', '自然化操作の実行に失敗', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  private isAuthPage(title: string, contentSnippet: string): boolean {
    return title.includes('認証') || /認証にご協力ください|verify|challenge/i.test(contentSnippet);
  }

  async reloadAndGetContent(
    url: string
  ): Promise<{ title: string; html: string; authDetected: boolean }> {
    const page = await this.ensureSession(url);

    try {
      const currentUrl = page.url();
      if (currentUrl && new URL(currentUrl).href === new URL(url).href) {
        await page.reload({ waitUntil: 'domcontentloaded' });
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      await this.softHumanize(page);
    } catch (e) {
      vibeLogger.debug('session.reload_failed', 'reload/gotoの実行に失敗', {
        context: { error: e instanceof Error ? e.message : String(e), url },
      });
    }

    const title = await page.title().catch(() => '');
    const html = await page.content().catch(() => '');
    const auth = this.isAuthPage(title, html.slice(0, 2000));

    if (auth) {
      this.state.consecutiveAuth += 1;
      vibeLogger.warn('session.auth_detected', '認証ページを検出しました', {
        context: { consecutiveAuth: this.state.consecutiveAuth, max: this.maxAuth },
      });
      if (this.state.consecutiveAuth >= this.maxAuth) {
        vibeLogger.info('session.recreate', '連続認証検出のためセッションを再生成します');
        await this.recreateSession(url);
      }
    } else {
      this.state.consecutiveAuth = 0;
    }

    return { title, html, authDetected: auth };
  }

  async destroy(): Promise<void> {
    const b = this.state.browser;
    this.state = { consecutiveAuth: 0 };
    try {
      await b?.close();
    } catch (e) {
      vibeLogger.debug('session.destroy_failed', 'ブラウザクローズでエラー', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }
}

export const sessionManager = new SessionManager();
