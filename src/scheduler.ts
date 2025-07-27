import * as cron from 'node-cron';
import { SimpleScraper } from './scraper';
import { TelegramNotifier } from './telegram';
import { SimpleStorage } from './storage';

export class MonitoringScheduler {
  private scraper = new SimpleScraper();
  private telegram: TelegramNotifier;
  private storage = new SimpleStorage();
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramNotifier(telegramToken, chatId);
  }

  async start(urls: string[]): Promise<void> {
    console.log(`[${new Date().toISOString()}] 監視開始:`, urls);
    
    // Telegram接続テスト
    const isConnected = await this.telegram.testConnection();
    if (!isConnected) {
      console.error('Telegram接続に失敗しました。環境変数を確認してください。');
      process.exit(1);
    }

    // 起動通知
    await this.telegram.sendStartupNotice();
    
    // 5分間隔で監視（毎時0,5,10,15...分に実行）
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        console.log('前回の監視がまだ実行中です。スキップします。');
        return;
      }

      this.isRunning = true;
      console.log(`\n====== 監視サイクル開始 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ======`);
      
      for (const url of urls) {
        await this.monitorUrl(url);
        // サーバー負荷軽減のため2秒待機
        await this.sleep(2000);
      }
      
      console.log(`====== 監視サイクル完了 ======\n`);
      this.isRunning = false;
    });

    // 統計情報を1時間ごとに報告
    cron.schedule('0 * * * *', () => {
      this.reportStatistics();
    });

    // 初回実行
    console.log('初回チェックを実行します...');
    this.isRunning = true;
    for (const url of urls) {
      await this.monitorUrl(url);
      await this.sleep(2000);
    }
    this.isRunning = false;
    console.log('初回チェック完了');
  }

  private async monitorUrl(url: string): Promise<void> {
    try {
      this.storage.incrementTotalChecks();
      console.log(`[${new Date().toISOString()}] チェック: ${url}`);
      
      const result = await this.scraper.scrapeAthome(url);
      
      if (!result.success) {
        console.error(`スクレイピング失敗: ${url} - ${result.error}`);
        this.storage.incrementErrors();
        await this.telegram.sendErrorAlert(url, result.error || '不明なエラー');
        return;
      }

      const previousHash = this.storage.getHash(url);
      
      if (!previousHash) {
        // 初回チェック
        console.log(`初回チェック完了: ${url} (${result.count}件)`);
        this.storage.setHash(url, result.hash);
      } else if (previousHash !== result.hash) {
        // 新着検知！
        console.log(`🎉 新着検知: ${url} (${result.count}件)`);
        this.storage.incrementNewListings();
        await this.telegram.sendNewListingAlert(url, result.count);
        this.storage.setHash(url, result.hash);
      } else {
        // 変更なし
        console.log(`変更なし: ${url} (${result.count}件)`);
      }

    } catch (error: any) {
      console.error(`監視エラー: ${url}`, error);
      this.storage.incrementErrors();
      await this.telegram.sendSystemAlert(`監視エラー: ${url}\n${error.message}`);
    }
  }

  private async reportStatistics(): Promise<void> {
    const stats = this.storage.getStatistics();
    const uptime = this.calculateUptime(stats.startedAt);
    
    const message = `📊 定期レポート

稼働時間: ${uptime}
総チェック数: ${stats.totalChecks}回
新着検知: ${stats.newListingsFound}件
エラー: ${stats.errors}回
エラー率: ${(stats.errors / stats.totalChecks * 100).toFixed(1)}%

監視URL数: ${this.storage.getAllUrls().length}件`;

    await this.telegram.sendSystemAlert(message);
  }

  private calculateUptime(startedAt: string): string {
    const start = new Date(startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}時間${minutes}分`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('監視を停止しました');
    }
  }
}