import { ScrapingResult, PropertyInfo } from './types.js';
import { vibeLogger } from './logger.js';
import * as crypto from 'crypto';

/**
 * Puppeteer Real Browser スクレイパー
 * 
 * @設計ドキュメント
 * - README.md: Puppeteer Real Browser戦略
 * - CLAUDE.md: 品質基準とスクレイピング戦略ルール
 * 
 * @関連クラス
 * - SimpleScraper: HTTP-firstスクレイパー（このクラスの呼び出し元）
 * - Logger: ログ出力
 * 
 * @主要機能
 * - 検出回避技術を搭載したブラウザ自動化
 * - Cloudflare/GeeTest認証の自動突破
 * - Cookie管理と再利用
 */
export class RealBrowserScraper {
  private cookieCache: Map<string, any[]> = new Map();
  private lastBrowser: any = null;
  private sessionUA: string;

  constructor() {
    // セッション固定UA
    const uaList = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ];
    this.sessionUA = uaList[Math.floor(Math.random() * uaList.length)] ?? uaList[0]!;
  }

  /**
   * Real Browserでスクレイピング実行
   */
  async scrapeAthome(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      vibeLogger.info('real_browser.start', `Real Browser スクレイピング開始: ${url}`, {
        context: { url, ua: this.sessionUA },
        humanNote: 'Puppeteer Real Browserで認証回避を試みます'
      });

      // タイムアウト管理のためのPromise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Real Browser timeout (25s)')), 25000);
      });

      // メイン処理
      const resultPromise = this.performScraping(url);

      // タイムアウトとメイン処理のrace
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      vibeLogger.error('real_browser.failed', `Real Browser スクレイピング失敗: ${url}`, {
        context: {
          url,
          executionTime,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : { message: String(error) }
        }
      });

      // ブラウザが残っていたらクリーンアップ
      if (this.lastBrowser) {
        try {
          await this.lastBrowser.close();
        } catch (e) {
          // ignore
        }
        this.lastBrowser = null;
      }

      return {
        success: false,
        hash: '',
        count: 0,
        error: errorMessage,
        failureReason: errorMessage.includes('認証') ? 'auth' : 
                       errorMessage.includes('timeout') ? 'network' : 'other',
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
      };
    }
  }

  private async performScraping(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    // ESMでdynamic importを使用（エラーハンドリング付き）
    let connect: any;
    try {
      const module = await import('puppeteer-real-browser');
      connect = module.connect;
    } catch (importError) {
      vibeLogger.error('real_browser.import_failed', 'puppeteer-real-browser のインポートに失敗', {
        context: { error: importError instanceof Error ? importError.message : String(importError) }
      });
      throw new Error('Failed to import puppeteer-real-browser');
    }
    
    // Real Browser接続設定（より軽量な設定）
    const { browser, page } = await connect({
      headless: process.env.NODE_ENV === 'production' ? 'new' : false, // 新しいheadlessモード
      turnstile: true, // Cloudflare Turnstile自動解決
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720', // 小さめのウィンドウサイズ
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process', // 単一プロセスモード
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--disable-webgl'
      ],
      customConfig: {},
      connectOption: {
        defaultViewport: { width: 1280, height: 720 }
      },
      disableXvfb: false, // Dockerでxvfbを使用
      ignoreAllFlags: false
    });

    this.lastBrowser = browser;
    
    try {
      // より自然なブラウザ挙動をシミュレート（軽量版）
      await page.evaluateOnNewDocument(() => {
        // Webdriver検出回避
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Chrome検出回避（最小限）
        (window as any).chrome = { runtime: {} };
      });
      
      // ユーザーエージェント設定
      await page.setUserAgent(this.sessionUA);

      // 既存Cookieがあれば注入
      const domain = new URL(url).hostname;
      if (this.cookieCache.has(domain)) {
        const cookies = this.cookieCache.get(domain);
        if (cookies && cookies.length > 0) {
          await page.setCookie(...cookies);
          vibeLogger.debug('real_browser.cookies_restored', `既存Cookie ${cookies.length}件を復元`, {
            context: { domain, cookieCount: cookies.length }
          });
        }
      }

      // ページ遷移（軽量な待機条件）
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 20000 
      });

      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 認証ページチェック（簡潔版）
      let pageTitle = await page.title();
      
      if (pageTitle.includes('認証')) {
        vibeLogger.info('real_browser.auth_detected', '認証ページを検出、待機します', {
          context: { title: pageTitle }
        });

        // 認証解決を待つ
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // ページをリロード
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        pageTitle = await page.title();
        if (pageTitle.includes('認証')) {
          vibeLogger.warn('real_browser.auth_persist', '認証が解決されませんでした', {
            context: { title: pageTitle }
          });
        }
      }

      // 物件要素の取得（簡潔版）
      const properties = await page.evaluate(() => {
        const selectors = [
          'athome-search-result-list-item',
          'athome-buy-other-object-list-item',
          '[class*="property"]',
          '[class*="bukken"]',
          '.item-cassette'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return Array.from(elements).slice(0, 3).map((el: any) => {
              const text = el.textContent || '';
              const title = text.split('\n')[0]?.trim() || '';
              const priceMatch = text.match(/[0-9,]+万円/);
              const price = priceMatch ? priceMatch[0] : '';
              return (title && price) ? { title, price, location: '' } : null;
            }).filter(Boolean);
          }
        }
        return [];
      });

      // Cookie保存
      const cookies = await page.cookies();
      this.cookieCache.set(domain, cookies);

      // ハッシュ計算（簡潔版）
      const hash = crypto.createHash('md5')
        .update(properties.map((p: any) => `${p.title}${p.price}`).join(''))
        .digest('hex');

      // ブラウザを閉じる
      await browser.close();
      this.lastBrowser = null;

      const executionTime = Date.now() - startTime;
      
      vibeLogger.info('real_browser.success', 'Real Browser スクレイピング成功', {
        context: {
          url,
          executionTime,
          propertiesCount: properties.length,
          hash
        }
      });

      return {
        success: true,
        hash,
        count: properties.length,
        properties: properties as PropertyInfo[],
        executionTime,
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
      };
      
    } finally {
      // 確実にブラウザを閉じる
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // ignore
        }
        this.lastBrowser = null;
      }
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.lastBrowser) {
      try {
        await this.lastBrowser.close();
      } catch (e) {
        // ignore
      }
      this.lastBrowser = null;
    }
  }
}