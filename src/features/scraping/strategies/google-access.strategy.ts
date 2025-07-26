import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page, ElementHandle } from 'playwright';
import { StealthConfig } from '../stealth/stealth-config';

export interface ScrapingResult {
  success: boolean;
  content?: string;
  method: string;
  executionTime: number;
  metadata?: any;
  error?: string;
}

interface SearchPattern {
  query: string;
  description: string;
}

@Injectable()
export class GoogleAccessStrategy {
  private readonly logger = new Logger(GoogleAccessStrategy.name);
  private readonly maxRetries = 3;
  private readonly baseDelay = 2000;

  async execute(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const browser = await chromium.launch(StealthConfig.getStealthOptions());

    try {
      const page = await browser.newPage();
      await StealthConfig.setupStealthMode(page);

      // Step 1: bot.sannysoft.com で事前準備
      await this.prepareBotDetection(page);

      // Step 2: 複数のGoogle検索パターンを試行
      const searchPatterns = this.generateSearchPatterns(url);

      for (let i = 0; i < searchPatterns.length; i++) {
        try {
          const result = await this.tryGoogleSearchPattern(
            page,
            searchPatterns[i],
            url,
          );
          if (result.success) {
            return {
              ...result,
              executionTime: Date.now() - startTime,
            };
          }
        } catch (error) {
          this.logger.warn(
            `Google search pattern ${i + 1} failed:`,
            error.message,
          );

          // 失敗時の適応的待機
          await this.adaptiveWait(i);
        }
      }

      throw new Error('All Google search patterns failed');
    } catch (error) {
      return {
        success: false,
        method: 'google-access',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      await browser.close();
    }
  }

  private async prepareBotDetection(page: Page): Promise<void> {
    this.logger.debug('Preparing bot detection evasion...');

    try {
      // bot.sannysoft.com でブラウザフィンガープリントをチェック
      await page.goto('https://bot.sannysoft.com', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // 人間らしい行動パターン
      await this.simulateHumanBehavior(page);

      // 3秒待機（重要：この待機時間が検知回避に必要）
      await page.waitForTimeout(3000);

      this.logger.debug('Bot detection preparation completed');
    } catch (error) {
      this.logger.warn(
        'Bot detection preparation failed, continuing...',
        error.message,
      );
    }
  }

  private generateSearchPatterns(targetUrl: string): SearchPattern[] {
    const domain = new URL(targetUrl).hostname;

    return [
      {
        query: `site:${domain}`,
        description: 'Site-specific search',
      },
      {
        query: `"${domain}" 不動産 物件`,
        description: 'Domain with keywords',
      },
      {
        query: `アットホーム 賃貸 物件検索`,
        description: 'Service-specific search',
      },
      {
        query: `${domain} 物件 検索`,
        description: 'Direct domain search',
      },
    ];
  }

  private async tryGoogleSearchPattern(
    page: Page,
    pattern: SearchPattern,
    targetUrl: string,
  ): Promise<ScrapingResult> {
    this.logger.debug(`Trying Google search pattern: ${pattern.description}`);

    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(pattern.query)}&hl=ja&gl=jp`;

    // Google検索ページにアクセス
    await page.goto(googleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // CAPTCHAチェック
    if (page.url().includes('/sorry/') || page.url().includes('captcha')) {
      throw new Error('Google CAPTCHA detected');
    }

    // 検索結果が表示されるまで待機
    await page.waitForSelector('#search', { timeout: 10000 });

    // 人間らしいスクロール動作
    await this.simulateHumanScrolling(page);

    // 目的サイトのリンクを探す
    const targetDomain = new URL(targetUrl).hostname;
    const targetLinks = await page.$$(`a[href*="${targetDomain}"]`);

    if (targetLinks.length === 0) {
      throw new Error(`No links found for domain: ${targetDomain}`);
    }

    // 最初のリンクをクリック
    const firstLink = targetLinks[0];

    // 人間らしいクリック動作
    await this.simulateHumanClick(page, firstLink);

    // ページ読み込み完了まで待機
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

    // 目的ページに到達したかチェック
    const currentUrl = page.url();
    if (!currentUrl.includes(targetDomain)) {
      throw new Error(
        `Failed to reach target domain. Current URL: ${currentUrl}`,
      );
    }

    // ページ内容を取得
    const content = await page.content();

    return {
      success: true,
      content,
      method: 'google-access',
      executionTime: 0, // Will be set by parent
      metadata: {
        searchPattern: pattern.description,
        finalUrl: currentUrl,
      },
    };
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    // ランダムなマウス移動
    const viewport = page.viewportSize();
    if (viewport) {
      for (let i = 0; i < 3; i++) {
        const x = Math.random() * viewport.width;
        const y = Math.random() * viewport.height;
        await page.mouse.move(x, y);
        await page.waitForTimeout(100 + Math.random() * 200);
      }
    }

    // ランダムなスクロール
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 300);
    });

    await page.waitForTimeout(500 + Math.random() * 1000);
  }

  private async simulateHumanScrolling(page: Page): Promise<void> {
    // 段階的なスクロール（人間らしい動作）
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 200 + Math.random() * 100);
      });
      await page.waitForTimeout(300 + Math.random() * 200);
    }
  }

  private async simulateHumanClick(
    page: Page,
    element: ElementHandle,
  ): Promise<void> {
    // 要素の位置を取得
    const box = await element.boundingBox();
    if (!box) {
      throw new Error('Element bounding box not found');
    }

    // 要素の中央付近をランダムにクリック
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);

    // マウスを移動してからクリック
    await page.mouse.move(x, y);
    await page.waitForTimeout(100 + Math.random() * 200);
    await page.mouse.click(x, y);
  }

  private async adaptiveWait(attemptNumber: number): Promise<void> {
    // 指数バックオフ + ランダムジッター
    const delay =
      this.baseDelay * Math.pow(2, attemptNumber) + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
