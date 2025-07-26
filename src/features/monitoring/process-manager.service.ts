import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser } from 'playwright';

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private activeBrowsers: Map<string, Browser> = new Map();
  private processTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async createBrowser(
    sessionId: string,
    maxLifetime: number = 300000,
  ): Promise<Browser> {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--memory-pressure-off',
          '--max_old_space_size=256',
        ],
      });

      this.activeBrowsers.set(sessionId, browser);

      // 最大生存時間の設定
      const timeout = setTimeout(() => {
        void this.closeBrowser(sessionId, 'TIMEOUT');
      }, maxLifetime);

      this.processTimeouts.set(sessionId, timeout);

      this.logger.log(`ブラウザプロセス作成: ${sessionId}`);
      return browser;
    } catch (error) {
      this.logger.error(`ブラウザプロセス作成失敗: ${error.message}`);
      throw error;
    }
  }

  async closeBrowser(
    sessionId: string,
    reason: string = 'MANUAL',
  ): Promise<void> {
    const browser = this.activeBrowsers.get(sessionId);
    const timeout = this.processTimeouts.get(sessionId);

    if (browser) {
      try {
        await browser.close();
        this.logger.log(`ブラウザプロセス終了: ${sessionId} (理由: ${reason})`);
      } catch (error) {
        this.logger.error(
          `ブラウザプロセス終了失敗: ${sessionId} - ${error.message}`,
        );
      }

      this.activeBrowsers.delete(sessionId);
    }

    if (timeout) {
      clearTimeout(timeout);
      this.processTimeouts.delete(sessionId);
    }
  }

  async closeAllBrowsers(): Promise<void> {
    const sessionIds = Array.from(this.activeBrowsers.keys());

    for (const sessionId of sessionIds) {
      await this.closeBrowser(sessionId, 'SHUTDOWN');
    }

    this.logger.log(`全ブラウザプロセス終了完了: ${sessionIds.length}個`);
  }

  getActiveProcessCount(): number {
    return this.activeBrowsers.size;
  }

  getProcessInfo(): Array<{ sessionId: string; createdAt: Date }> {
    return Array.from(this.activeBrowsers.keys()).map((sessionId) => ({
      sessionId,
      createdAt: new Date(), // 実際の実装では作成時刻を記録
    }));
  }

  onModuleDestroy(): Promise<void> {
    return this.closeAllBrowsers();
  }
}
