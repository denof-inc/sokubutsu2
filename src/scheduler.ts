import * as cron from 'node-cron';
import { SimpleScraper } from './scraper.js';
import { TelegramNotifier } from './telegram.js';
import { SimpleStorage } from './storage.js';
import { PropertyMonitor } from './property-monitor.js';
import { NewPropertyDetectionResult } from './types.js';
import { vibeLogger } from './logger.js';
import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from './circuit-breaker.js';
import { config } from './config.js';

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
  private readonly circuitBreaker: CircuitBreaker;
  private readonly urlErrorCounts: Map<string, number> = new Map();

  private cronJob: cron.ScheduledTask | null = null;
  private statsJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;
  private readonly maxUrlConsecutiveErrors = 3;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramNotifier(telegramToken, chatId);
    
    // サーキットブレーカーの初期化
    const cbConfig: CircuitBreakerConfig = {
      maxConsecutiveErrors: config.circuitBreaker.maxConsecutiveErrors,
      errorRateThreshold: config.circuitBreaker.errorRateThreshold,
      windowSizeMs: config.circuitBreaker.windowSizeMinutes * 60 * 1000,
      recoveryTimeMs: config.circuitBreaker.recoveryTimeMinutes * 60 * 1000,
      autoRecoveryEnabled: config.circuitBreaker.autoRecoveryEnabled,
    };
    this.circuitBreaker = new CircuitBreaker(cbConfig);
  }

  /**
   * 監視開始
   */
  async start(urls: string[], telegramEnabled: boolean = true): Promise<void> {
    vibeLogger.info('monitoring.start', `監視開始: ${urls.length}件のURL`, {
      context: { urlCount: urls.length, urls, telegramEnabled },
      humanNote: 'システムの監視プロセスを開始',
    });

    if (telegramEnabled) {
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
    } else {
      vibeLogger.info('scheduler.telegram_disabled', 'Telegram通知は無効化されています', {
        context: { telegramEnabled: false },
        humanNote: 'テストモードでの統計表示',
      });
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

      void this.runMonitoringCycle(urls, telegramEnabled);
    });

    // 1時間ごとに統計レポート送信
    this.statsJob = cron.schedule('0 * * * *', () => {
      void this.sendStatisticsReport(telegramEnabled, urls);
    });

    // 初回実行
    vibeLogger.info('monitoring.initial_check', '初回チェックを実行します...', {
      context: { urls },
    });
    await this.runMonitoringCycle(urls, telegramEnabled);
    vibeLogger.info('monitoring.initial_check_complete', '初回チェック完了', {
      humanNote: 'システムが正常に稼働開始',
    });
  }

  /**
   * 監視サイクル実行
   */
  private async runMonitoringCycle(urls: string[], telegramEnabled: boolean = true): Promise<void> {
    // サーキットブレーカーがOPENの場合はスキップ
    if (this.circuitBreaker.isOpen()) {
      vibeLogger.warn('monitoring.cycle.skipped', 'サーキットブレーカーが作動中のため監視をスキップ', {
        context: this.circuitBreaker.getStats(),
      });
      return;
    }
    
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
        await this.monitorUrl(url, telegramEnabled);
        successCount++;
        this.consecutiveErrors = 0; // 成功時はリセット
        
        // サーキットブレーカーに成功を記録
        this.circuitBreaker.recordSuccess();

        // サーバー負荷軽減のため2秒待機
        await this.sleep(2000);
      } catch (error) {
        errorCount++;
        this.consecutiveErrors++;
        
        // サーキットブレーカーにエラーを記録
        const errorMessage = error instanceof Error ? error.message : String(error);
        const shouldStop = this.circuitBreaker.recordError(errorMessage);
        
        if (shouldStop && telegramEnabled) {
          // サーキットブレーカーが作動した場合、管理者に通知
          await this.telegram.sendMessage(
            `🚨 エラー頻発により監視を一時停止しました\n\n` +
            `連続エラー: ${this.consecutiveErrors}回\n` +
            `詳細: ${errorMessage}\n\n` +
            (config.circuitBreaker.autoRecoveryEnabled 
              ? `⏱ ${config.circuitBreaker.recoveryTimeMinutes}分後に自動復旧を試みます`
              : '手動での復旧が必要です')
          );
        }
        
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
        if (telegramEnabled && this.consecutiveErrors >= this.maxConsecutiveErrors) {
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

    // Telegram無効時は統計を表示
    if (!telegramEnabled) {
      this.displayStatisticsToConsole();
    }

    this.isRunning = false;
  }

  /**
   * URL監視
   */
  private async monitorUrl(url: string, telegramEnabled: boolean = true): Promise<void> {
    vibeLogger.info('monitoring.url.check', `チェック開始: ${url}`, {
      context: { url },
    });

    this.storage.incrementTotalChecks();
    this.storage.incrementUrlCheck(url);

    const result = await this.scraper.scrapeAthome(url);

    if (!result.success) {
      this.storage.incrementErrors();
      this.storage.incrementUrlError(url);
      
      // URL別のエラーカウントを更新
      const currentErrorCount = (this.urlErrorCounts.get(url) || 0) + 1;
      this.urlErrorCounts.set(url, currentErrorCount);
      
      // 3回連続エラー（15分間）の場合のみ警告通知
      if (telegramEnabled && currentErrorCount >= this.maxUrlConsecutiveErrors) {
        await this.telegram.sendErrorAlert(url, `15分間継続エラー: ${result.error || '不明なエラー'}`);
        // 通知後はカウンターをリセット
        this.urlErrorCounts.set(url, 0);
      }
      return;
    }
    
    // 成功時はURLのエラーカウンターをリセット
    this.urlErrorCounts.set(url, 0);
    this.storage.incrementUrlSuccess(url);

    // 実行時間を記録
    if (result.executionTime) {
      this.storage.recordExecutionTime(result.executionTime);
      this.storage.recordUrlExecutionTime(url, result.executionTime);
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
      this.storage.recordUrlNewProperty(url, detectionResult.newPropertyCount);

      // 新着物件通知を送信
      if (telegramEnabled) {
        await this.sendNewPropertyNotification(detectionResult, url);
      }
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
   * URLごとの統計情報を取得
   */
  private async getUrlStatistics(url: string): Promise<import('./types.js').UrlStatistics> {
    return this.storage.getUrlStats(url);
  }

  /**
   * URLごとのサマリーレポートを送信
   */
  private async sendUrlSummaryReports(urls: string[], telegramEnabled: boolean = true): Promise<void> {
    if (!telegramEnabled) {
      return;
    }
    
    for (const url of urls) {
      try {
        const urlStats = await this.getUrlStatistics(url);
        await this.telegram.sendUrlSummaryReport(urlStats);
        
        vibeLogger.info('monitoring.url_report_sent', 'URL別レポート送信完了', {
          context: { url, stats: urlStats },
        });
      } catch (error) {
        vibeLogger.error('monitoring.url_report_error', 'URL別レポート送信エラー', {
          context: {
            url,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  /**
   * 統計レポート送信
   */
  private async sendStatisticsReport(telegramEnabled: boolean = true, urls: string[] = []): Promise<void> {
    try {
      // 全体統計レポート
      const stats = this.storage.getStats();
      if (telegramEnabled) {
        await this.telegram.sendStatisticsReport(stats);
        vibeLogger.info('monitoring.stats_report_sent', '統計レポート送信完了', {
          context: { stats },
        });
        
        // URLごとのサマリーレポート
        if (urls.length > 0) {
          await this.sendUrlSummaryReports(urls, telegramEnabled);
        }
      } else {
        this.displayStatisticsToConsole();
      }
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
   * サーキットブレーカーを手動リセット
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    this.consecutiveErrors = 0;
    vibeLogger.info('monitoring.circuit_breaker.reset', 'サーキットブレーカーをリセットしました');
  }

  /**
   * サーキットブレーカーの状態を取得
   */
  getCircuitBreakerStatus(): {
    state: CircuitState;
    stats: ReturnType<CircuitBreaker['getStats']>;
  } {
    return {
      state: this.circuitBreaker.getState(),
      stats: this.circuitBreaker.getStats(),
    };
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
  async runManualCheck(urls: string[], telegramEnabled: boolean = true): Promise<void> {
    vibeLogger.info('monitoring.manual_check_start', '手動チェック開始', {
      context: { urls },
    });
    await this.runMonitoringCycle(urls, telegramEnabled);
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

  /**
   * 統計情報をコンソールに表示
   */
  private displayStatisticsToConsole(): void {
    const stats = this.storage.getStats();
    const monitoringStats = this.propertyMonitor.getMonitoringStatistics();

    console.log('\n📊 監視統計レポート');
    console.log('===================');
    console.log(`📅 ${new Date().toLocaleString('ja-JP')}`);
    console.log();
    console.log('📈 全体統計:');
    console.log(`  • 総チェック数: ${stats.totalChecks}回`);
    console.log(`  • 成功率: ${stats.successRate}%`);
    console.log(`  • 平均実行時間: ${stats.averageExecutionTime.toFixed(2)}秒`);
    console.log();
    console.log('🏠 物件監視統計:');
    console.log(`  • 新着検知回数: ${monitoringStats.newPropertyDetections}回`);
    console.log(`  • 最終監視: ${monitoringStats.lastCheckAt.toLocaleString('ja-JP')}`);
    if (monitoringStats.lastNewPropertyAt) {
      console.log(`  • 最終新着検知: ${monitoringStats.lastNewPropertyAt.toLocaleString('ja-JP')}`);
    }
    console.log();
    console.log('⚠️  エラー統計:');
    console.log(`  • エラー回数: ${stats.errors}回`);
    console.log(`  • エラー率: ${(100 - stats.successRate).toFixed(1)}%`);
    console.log('===================\n');
  }
}
