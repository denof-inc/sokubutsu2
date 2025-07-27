import * as cron from 'node-cron';
import { SimpleScraper } from './scraper';
import { TelegramNotifier } from './telegram';
import { SimpleStorage } from './storage';
import { NotificationData } from './types';
import { logger } from './logger';
import { performanceMonitor } from './performance';

/**
 * 監視スケジューラー
 * 
 * @設計ドキュメント
 * - README.md: 監視フロー全体像
 * - docs/スケジューリング設計.md: cron式と実行タイミング
 * 
 * @関連クラス
 * - SimpleScraper: 実際のスクレイピング処理を実行
 * - TelegramNotifier: 新着検知時の通知送信
 * - SimpleStorage: ハッシュ値の読み書き、統計情報の管理
 * - Logger: 監視サイクルのログ出力
 * - performanceMonitor: パフォーマンス測定
 * 
 * @主要機能
 * - 5分間隔での定期監視実行
 * - 新着物件の変化検知
 * - 1時間ごとの統計レポート送信
 * - 連続エラー監視とアラート
 */
export class MonitoringScheduler {
  private readonly scraper = new SimpleScraper();
  private readonly telegram: TelegramNotifier;
  private readonly storage = new SimpleStorage();
  
  private cronJob: cron.ScheduledTask | null = null;
  private statsJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramNotifier(telegramToken, chatId);
  }

  /**
   * 監視開始
   */
  async start(urls: string[]): Promise<void> {
    logger.info(`監視開始: ${urls.length}件のURL`);

    // Telegram接続テスト
    const isConnected = await this.telegram.testConnection();
    if (!isConnected) {
      throw new Error('Telegram接続に失敗しました。環境変数を確認してください。');
    }

    // 起動通知
    await this.telegram.sendStartupNotice();

    // 5分間隔で監視（毎時0,5,10,15...分に実行）
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        logger.warn('前回の監視がまだ実行中です。スキップします。');
        return;
      }

      await this.runMonitoringCycle(urls);
    });

    // 1時間ごとに統計レポート送信
    this.statsJob = cron.schedule('0 * * * *', async () => {
      await this.sendStatisticsReport();
    });

    // 初回実行
    logger.info('初回チェックを実行します...');
    await this.runMonitoringCycle(urls);
    logger.info('初回チェック完了');
  }

  /**
   * 監視サイクル実行
   */
  private async runMonitoringCycle(urls: string[]): Promise<void> {
    this.isRunning = true;
    const cycleStartTime = Date.now();
    
    logger.info(`====== 監視サイクル開始 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ======`);
    
    let successCount = 0;
    let errorCount = 0;

    for (const url of urls) {
      try {
        await this.monitorUrl(url);
        successCount++;
        this.consecutiveErrors = 0; // 成功時はリセット
        
        // サーバー負荷軽減のため2秒待機
        await this.sleep(2000);
        
      } catch (error) {
        errorCount++;
        this.consecutiveErrors++;
        logger.error(`URL監視エラー: ${url}`, error);
        
        // 連続エラーが多い場合は警告
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          await this.telegram.sendErrorAlert(url, `連続エラー${this.consecutiveErrors}回`);
        }
      }
    }

    const cycleTime = Date.now() - cycleStartTime;
    logger.info(`====== 監視サイクル完了 (${cycleTime}ms, 成功:${successCount}, エラー:${errorCount}) ======`);
    
    this.isRunning = false;
  }

  /**
   * URL監視
   */
  private async monitorUrl(url: string): Promise<void> {
    logger.info(`チェック開始: ${url}`);
    
    this.storage.incrementTotalChecks();
    
    const result = await this.scraper.scrapeAthome(url);
    
    if (!result.success) {
      this.storage.incrementErrors();
      await this.telegram.sendErrorAlert(url, result.error || '不明なエラー');
      return;
    }

    // 実行時間を記録
    if (result.executionTime) {
      this.storage.recordExecutionTime(result.executionTime);
    }

    const previousHash = this.storage.getHash(url);
    
    if (!previousHash) {
      // 初回チェック
      logger.info(`初回チェック完了: ${url} (${result.count}件)`);
      this.storage.setHash(url, result.hash);
      
    } else if (previousHash !== result.hash) {
      // 新着検知！
      logger.info(`🎉 新着検知: ${url} (${result.count}件)`);
      this.storage.incrementNewListings();
      
      // 前回の物件数を推定（簡易実装）
      const previousCount = await this.estimatePreviousCount(url, previousHash);
      
      const notificationData: NotificationData = {
        currentCount: result.count,
        previousCount,
        detectedAt: new Date(),
        url,
        executionTime: (result.executionTime || 0) / 1000,
      };
      
      await this.telegram.sendNewListingNotification(notificationData);
      this.storage.setHash(url, result.hash);
      
    } else {
      // 変化なし
      logger.debug(`変化なし: ${url} (${result.count}件)`);
    }
  }

  /**
   * 前回の物件数を推定（簡易実装）
   */
  private async estimatePreviousCount(url: string, previousHash: string): Promise<number> {
    // 実際の実装では、ハッシュと物件数の対応を保存することを推奨
    // ここでは簡易的に現在の物件数から推定
    const currentResult = await this.scraper.scrapeAthome(url);
    return currentResult.success ? Math.max(0, currentResult.count - 1) : 0;
  }

  /**
   * 統計レポート送信
   */
  private async sendStatisticsReport(): Promise<void> {
    try {
      const stats = this.storage.getStats();
      await this.telegram.sendStatisticsReport(stats);
      logger.info('統計レポート送信完了');
    } catch (error) {
      logger.error('統計レポート送信エラー', error);
    }
  }

  /**
   * 監視停止
   */
  stop(): void {
    logger.info('監視停止中...');
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    if (this.statsJob) {
      this.statsJob.stop();
      this.statsJob = null;
    }
    
    // 停止通知
    this.telegram.sendShutdownNotice().catch(error => {
      logger.error('停止通知送信エラー', error);
    });
    
    logger.info('監視停止完了');
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 手動実行（テスト用）
   */
  async runManualCheck(urls: string[]): Promise<void> {
    logger.info('手動チェック開始');
    await this.runMonitoringCycle(urls);
    logger.info('手動チェック完了');
  }

  /**
   * スケジューラー状態取得
   */
  getStatus(): { isRunning: boolean; consecutiveErrors: number; hasJobs: boolean } {
    return {
      isRunning: this.isRunning,
      consecutiveErrors: this.consecutiveErrors,
      hasJobs: this.cronJob !== null && this.statsJob !== null,
    };
  }
}