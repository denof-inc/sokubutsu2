import * as cron from 'node-cron';
import { SimpleScraper } from './scraper';
import { TelegramNotifier } from './telegram';
import { SimpleStorage } from './storage';
import { PropertyMonitor } from './property-monitor';
import { NewPropertyDetectionResult } from './types';
import { vibeLogger } from './logger';

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
  private readonly propertyMonitor = new PropertyMonitor();

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
    vibeLogger.info('monitoring.start', `監視開始: ${urls.length}件のURL`, {
      context: { urlCount: urls.length, urls },
      humanNote: 'システムの監視プロセスを開始',
    });

    // Telegram接続テスト
    const isConnected = await this.telegram.testConnection();
    if (!isConnected) {
      vibeLogger.warn('scheduler.telegram_skip', 'Telegram接続失敗のため通知機能をスキップ', {
        context: { testMode: true },
        humanNote: 'テストモードのため継続',
      });
    } else {
      // 起動通知
      await this.telegram.sendStartupNotice();
    }

    // 5分間隔で監視（毎時0,5,10,15...分に実行）
    this.cronJob = cron.schedule('*/5 * * * *', () => {
      if (this.isRunning) {
        vibeLogger.warn('monitoring.skip', '前回の監視がまだ実行中です。スキップします。', {
          context: { isRunning: this.isRunning },
          aiTodo: '監視サイクルが遅延している可能性を分析',
        });
        return;
      }

      void this.runMonitoringCycle(urls);
    });

    // 1時間ごとに統計レポート送信
    this.statsJob = cron.schedule('0 * * * *', () => {
      void this.sendStatisticsReport();
    });

    // 初回実行
    vibeLogger.info('monitoring.initial_check', '初回チェックを実行します...', {
      context: { urls },
    });
    await this.runMonitoringCycle(urls);
    vibeLogger.info('monitoring.initial_check_complete', '初回チェック完了', {
      humanNote: 'システムが正常に稼働開始',
    });
  }

  /**
   * 監視サイクル実行
   */
  private async runMonitoringCycle(urls: string[]): Promise<void> {
    this.isRunning = true;
    const cycleStartTime = Date.now();

    const cycleId = `cycle-${Date.now()}`;
    vibeLogger.info('monitoring.cycle.start', '監視サイクル開始', {
      context: {
        cycleId,
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        urlCount: urls.length,
      },
    });

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
        vibeLogger.error('monitoring.url.error', `URL監視エラー: ${url}`, {
          context: {
            url,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : { message: String(error) },
            consecutiveErrors: this.consecutiveErrors,
          },
          aiTodo: 'エラーパターンを分析し、対策を提案',
        });

        // 連続エラーが多い場合は警告
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          await this.telegram.sendErrorAlert(url, `連続エラー${this.consecutiveErrors}回`);
        }
      }
    }

    const cycleTime = Date.now() - cycleStartTime;
    vibeLogger.info('monitoring.cycle.complete', '監視サイクル完了', {
      context: {
        cycleId,
        cycleTime,
        successCount,
        errorCount,
        successRate: urls.length > 0 ? Math.round((successCount / urls.length) * 100) : 0,
      },
      humanNote: '監視サイクルのパフォーマンスを確認',
    });

    this.isRunning = false;
  }

  /**
   * URL監視
   */
  private async monitorUrl(url: string): Promise<void> {
    vibeLogger.info('monitoring.url.check', `チェック開始: ${url}`, {
      context: { url },
    });

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

    // 新着物件検知ロジックを使用
    const detectionResult = this.propertyMonitor.detectNewProperties(result.properties || []);

    // ハッシュ値の管理（互換性のため維持）
    const previousHash = this.storage.getHash(url);
    if (!previousHash) {
      // 初回チェック
      vibeLogger.info('monitoring.initial_url_check', `初回チェック完了: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
      this.storage.setHash(url, result.hash);
    } else if (detectionResult.hasNewProperty) {
      // 新着検知！
      vibeLogger.info('monitoring.new_listing_detected', `🎉 新着検知: ${url}`, {
        context: {
          url,
          newPropertyCount: detectionResult.newPropertyCount,
          totalMonitored: detectionResult.totalMonitored,
          confidence: detectionResult.confidence,
        },
        humanNote: '新着物件を検知しました！',
        aiTodo: '検知パターンを分析し、通知タイミングを最適化',
      });
      this.storage.incrementNewListings();

      // 新着物件通知を送信
      await this.sendNewPropertyNotification(detectionResult, url);
      this.storage.setHash(url, result.hash);
    } else {
      // 変化なし
      vibeLogger.debug('monitoring.no_change', `変化なし: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
    }
  }

  /**
   * 新着物件通知を送信
   */
  private async sendNewPropertyNotification(
    detectionResult: NewPropertyDetectionResult,
    url: string
  ): Promise<void> {
    try {
      const message = this.createNewPropertyMessage(detectionResult, url);
      await this.telegram.sendMessage(message);

      vibeLogger.info('monitoring_scheduler.notification_sent', '新着物件通知送信完了', {
        context: {
          newPropertyCount: detectionResult.newPropertyCount,
          confidence: detectionResult.confidence,
        },
        humanNote: '新着物件通知が正常に送信されました',
      });
    } catch (error) {
      vibeLogger.error('monitoring_scheduler.notification_failed', '新着物件通知送信失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
        humanNote: '新着物件通知の送信に失敗しました',
      });
    }
  }

  /**
   * 新着物件通知メッセージを作成
   */
  private createNewPropertyMessage(
    detectionResult: NewPropertyDetectionResult,
    url: string
  ): string {
    const { newPropertyCount, totalMonitored, confidence, detectedAt } = detectionResult;

    let message = `🆕 **新着物件発見！**\n\n`;
    message += `📊 **検知情報**\n`;
    message += `• 新着件数: ${newPropertyCount}件\n`;
    message += `• 監視範囲: 最新${totalMonitored}件\n`;
    message += `• 信頼度: ${this.getConfidenceText(confidence)}\n`;
    message += `• 検知時刻: ${detectedAt.toLocaleString('ja-JP')}\n\n`;

    // 新着物件の詳細
    if (detectionResult.newProperties.length > 0) {
      message += `🏠 **新着物件詳細**\n`;
      detectionResult.newProperties.forEach((property, index) => {
        message += `${index + 1}. ${property.title}\n`;
        message += `   💰 ${property.price}\n`;
        if (property.location) {
          message += `   📍 ${property.location}\n`;
        }
        message += `\n`;
      });
    }

    message += `🔗 **確認はこちら**\n`;
    message += url;

    return message;
  }

  /**
   * 信頼度テキストを取得
   */
  private getConfidenceText(confidence: string): string {
    switch (confidence) {
      case 'very_high':
        return '非常に高い ⭐⭐⭐';
      case 'high':
        return '高い ⭐⭐';
      case 'medium':
        return '中程度 ⭐';
      default:
        return confidence;
    }
  }

  /**
   * 前回の物件数を推定（簡易実装）
   */
  private async estimatePreviousCount(url: string): Promise<number> {
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
      vibeLogger.info('monitoring.stats_report_sent', '統計レポート送信完了', {
        context: { stats },
      });
    } catch (error) {
      vibeLogger.error('monitoring.stats_report_error', '統計レポート送信エラー', {
        context: {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
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
      vibeLogger.error('monitoring.shutdown_notice_error', '停止通知送信エラー', {
        context: {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
        },
      });
    });

    vibeLogger.info('monitoring.stopped', '監視停止完了', {
      humanNote: 'システムが正常に停止しました',
    });
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
    vibeLogger.info('monitoring.manual_check_start', '手動チェック開始', {
      context: { urls },
    });
    await this.runMonitoringCycle(urls);
    vibeLogger.info('monitoring.manual_check_complete', '手動チェック完了', {
      humanNote: '手動チェックが正常に完了',
    });
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
