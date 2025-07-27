import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { ScrapingResult } from './google-access.strategy';

@Injectable()
export class ProvenGoogleAccessStrategy {
  private readonly logger = new Logger(ProvenGoogleAccessStrategy.name);

  async execute(url: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const browser = await chromium.launch({
      headless: false, // 重要: 成功例と同じ設定
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
      ],
    });

    try {
      const page = await browser.newPage();

      // 成功例と同じUser-Agent設定
      await page.setExtraHTTPHeaders({
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // 成功例と同じViewport設定
      await page.setViewportSize({ width: 1366, height: 768 });

      // Step 1: bot.sannysoft.com アクセス（成功例と完全同一）
      this.logger.debug('Accessing bot.sannysoft.com...');
      await page.goto('https://bot.sannysoft.com', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Step 2: 成功例と同じ3秒待機（重要）
      this.logger.debug('Waiting 3 seconds...');
      await new Promise((r) => setTimeout(r, 3000));

      // Step 3: Google直接アクセス（検索ではない）
      this.logger.debug('Accessing Google...');
      await page.goto('https://www.google.com', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Step 4: 短い待機後、目的サイトへ直接遷移
      await new Promise((r) => setTimeout(r, 400));

      // Step 5: 目的サイトへの直接アクセス
      this.logger.debug(`Accessing target site: ${url}`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // networkidleは厳しすぎるため変更
        timeout: 20000,
      });

      // ページ読み込み完了を確実に待つ
      await page.waitForTimeout(2000);

      // CAPTCHA検出チェック
      const currentUrl = page.url();
      if (currentUrl.includes('/sorry/') || currentUrl.includes('captcha')) {
        throw new Error('CAPTCHA detected after proven pattern');
      }

      const content = await page.content();

      return {
        success: true,
        content,
        method: 'proven-google-access',
        executionTime: Date.now() - startTime,
        metadata: {
          pattern: 'bot.sannysoft.com → Google → target',
          finalUrl: currentUrl,
        },
      };
    } catch (error) {
      this.logger.error(
        `Proven Google access failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        method: 'proven-google-access',
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await browser.close();
    }
  }
}
