import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import * as crypto from 'crypto';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  async scrapeAndGetHash(url: string, selector: string): Promise<string | null> {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      await page.waitForSelector(selector, { timeout: 30000 });

      const element = await page.$(selector);
      if (!element) {
        this.logger.warn(`[${url}] セレクタ "${selector}" が見つかりませんでした。`);
        return null;
      }

      const content = await element.innerHTML();
      
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      this.logger.error(`スクレイピング中にエラーが発生しました: ${url}`, error.stack);
      return null;
    } finally {
      await browser.close();
    }
  }
}
