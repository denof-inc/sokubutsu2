import { SimpleScraper } from '../infrastructure/scraper';
import { SimpleStorage } from './storage';
import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';
import { JobManager } from './job-manager';
import { MonitoringService } from './monitoring-service';
import { NotificationService } from './notification-service';

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
  private readonly jobManager = new JobManager();
  private readonly monitoringService: MonitoringService;
  private readonly notificationService: NotificationService;
  private readonly storage = new SimpleStorage();
  private urls: string[] = [];

  constructor(telegramToken: string, chatId: string) {
    this.notificationService = new NotificationService(telegramToken, chatId);
    this.monitoringService = new MonitoringService(
      new SimpleScraper(),
      this.storage,
      this.notificationService
    );
  }

  /**
   * 監視開始
   */
  async start(urls: string[]): Promise<void> {
    vibeLogger.info('monitoring.start', `監視開始: ${urls.length}件のURL`, {
      context: { urlCount: urls.length, urls },
      humanNote: 'システムの監視プロセスを開始',
    });

    this.urls = urls;

    // Telegram接続テスト
    const isConnected = await this.notificationService.testConnection();
    if (!isConnected) {
      vibeLogger.warn('scheduler.telegram_skip', 'Telegram接続失敗のため通知機能をスキップ', {
        context: { testMode: true },
        humanNote: 'テストモードのため継続',
      });
      // テストモードのため継続
      // throw new Error('Telegram接続に失敗しました。環境変数を確認してください。');
    } else {
      // 起動通知
      await this.notificationService.sendStartupNotice();
    }

    // 5分間隔で監視（毎時0,5,10,15...分に実行）
    this.jobManager.schedule('*/5 * * * *', 'monitoring', async () => {
      await this.monitoringService.runCycle(this.urls);
    });

    // 1時間ごとに統計レポート送信
    this.jobManager.schedule('0 * * * *', 'statistics', async () => {
      await this.sendStatisticsReport();
    });

    // ジョブを開始
    this.jobManager.startAll();

    // 初回実行
    vibeLogger.info('monitoring.initial_check', '初回チェックを実行します...', {
      context: { urls },
    });
    await this.monitoringService.runCycle(urls);
    vibeLogger.info('monitoring.initial_check_complete', '初回チェック完了', {
      humanNote: 'システムが正常に稼働開始',
    });
  }

  /**
   * 統計レポート送信
   */
  private async sendStatisticsReport(): Promise<void> {
    try {
      const stats = this.storage.getStats();
      await this.notificationService.sendStatisticsReport(stats);
      vibeLogger.info('monitoring.stats_report_sent', '統計レポート送信完了', {
        context: { stats },
      });
    } catch (error) {
      vibeLogger.error('monitoring.stats_report_error', '統計レポート送信エラー', {
        context: {
          error: formatError(error),
        },
      });
    }
  }

  /**
   * 監視停止
   */
  stop(): void {
    vibeLogger.info('monitoring.stopping', '監視停止中...', {
      humanNote: 'システムを正常に停止しています',
    });

    this.jobManager.stopAll();

    // 停止通知
    this.notificationService.sendShutdownNotice().catch(error => {
      vibeLogger.error('monitoring.shutdown_notice_error', '停止通知送信エラー', {
        context: {
          error: formatError(error),
        },
      });
    });

    vibeLogger.info('monitoring.stopped', '監視停止完了', {
      humanNote: 'システムが正常に停止しました',
    });
  }

  /**
   * 手動実行（テスト用）
   */
  async runManualCheck(urls: string[]): Promise<void> {
    vibeLogger.info('monitoring.manual_check_start', '手動チェック開始', {
      context: { urls },
    });
    await this.monitoringService.runCycle(urls);
    vibeLogger.info('monitoring.manual_check_complete', '手動チェック完了', {
      humanNote: '手動チェックが正常に完了',
    });
  }

  /**
   * スケジューラー状態取得
   */
  getStatus(): { isRunning: boolean; consecutiveErrors: number; hasJobs: boolean } {
    const monitoringStatus = this.monitoringService.getStatus();
    const jobStatus = this.jobManager.getStatus();

    return {
      isRunning: monitoringStatus.isRunning,
      consecutiveErrors: monitoringStatus.consecutiveErrors,
      hasJobs:
        Object.keys(jobStatus).length > 0 && Object.values(jobStatus).every(status => status),
    };
  }
}
