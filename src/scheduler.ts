import * as cron from 'node-cron';
import { SimpleScraper } from './scraper.js';
import { TelegramNotifier } from './telegram.js';
import { SimpleStorage } from './storage.js';
import { PropertyMonitor } from './property-monitor.js';
import { NewPropertyDetectionResult } from './types.js';
import { vibeLogger } from './logger.js';
import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from './circuit-breaker.js';
import { config } from './config.js';
import { UserService } from './services/UserService.js';

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
  private monitoringUrls: string[] = [];

  private cronJob: cron.ScheduledTask | null = null;
  private statsJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;
  private readonly maxUrlConsecutiveErrors = 3;
  private readonly urlCheckHistory: Map<
    string,
    Array<{ time: string; status: 'なし' | 'あり' | 'エラー' }>
  > = new Map();
  private readonly urlCooldownUntil: Map<string, number> = new Map();

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
    this.monitoringUrls = urls;
    vibeLogger.info('monitoring.start', `監視開始: ${urls.length}件のURL`, {
      context: { urlCount: urls.length, urls, telegramEnabled },
      humanNote: 'システムの監視プロセスを開始',
    });

    // 運用時間状態を初期化
    const { operatingStateStorage } = await import('./utils/operatingHours.js');
    operatingStateStorage.recordCurrentState();

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

    // 監視間隔は設定から取得（デフォルト5分）
    this.cronJob = cron.schedule(config.monitoring.interval || '*/5 * * * *', () => {
      if (this.isRunning) {
        vibeLogger.warn('monitoring.skip', '前回の監視がまだ実行中です。スキップします。', {
          context: { isRunning: this.isRunning },
          aiTodo: '監視サイクルが遅延している可能性を分析',
        });
        return;
      }

      void this.runMonitoringCycle(urls, telegramEnabled);
    });

    // 統計レポート送信（毎時20分・固定）
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
    // 運用時間チェック
    const { isWithinOperatingHours, operatingStateStorage } = await import(
      './utils/operatingHours.js'
    );
    const operatingStatus = isWithinOperatingHours();

    if (!operatingStatus.isOperating) {
      vibeLogger.info(
        'monitoring.cycle.skipped_operating_hours',
        '運用時間外のため監視をスキップ',
        {
          context: {
            currentHour: operatingStatus.currentHour,
            nextChangeHour: operatingStatus.nextChangeHour,
            message: operatingStatus.message,
          },
          humanNote: '22時〜6時の運用停止時間帯',
        }
      );

      // 運用状態変更の通知処理
      const stateChange = operatingStateStorage.hasStateChanged();
      if (stateChange.changed && !stateChange.currentState && telegramEnabled) {
        const { createOperatingStopMessage } = await import('./utils/operatingHours.js');
        await this.telegram.sendMessage(createOperatingStopMessage());
      }

      return;
    }

    // 運用再開時の通知処理
    const stateChange = operatingStateStorage.hasStateChanged();
    if (stateChange.changed && stateChange.currentState && telegramEnabled) {
      const { createOperatingStartMessage } = await import('./utils/operatingHours.js');
      await this.telegram.sendMessage(createOperatingStartMessage());
    }

    // サーキットブレーカーがOPENの場合はスキップ
    if (this.circuitBreaker.isOpen()) {
      vibeLogger.warn(
        'monitoring.cycle.skipped',
        'サーキットブレーカーが作動中のため監視をスキップ',
        {
          context: this.circuitBreaker.getStats(),
        }
      );
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
        operatingHour: operatingStatus.currentHour,
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
    // 認証クールダウン中ならスキップ（過剰叩きによる悪化防止）
    const nowEpoch = Date.now();
    const cd = this.urlCooldownUntil.get(url) || 0;
    if (nowEpoch < cd) {
      vibeLogger.warn('monitoring.url.cooldown', '認証クールダウン中のためスキップ', {
        context: { url, until: new Date(cd).toISOString() },
      });
      return;
    }
    vibeLogger.info('monitoring.url.check', `チェック開始: ${url}`, {
      context: { url },
    });

    this.storage.incrementTotalChecks();
    this.storage.incrementUrlCheck(url);

    // 現在時刻を取得（履歴記録用）
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });

    const result = await this.scraper.scrapeAthome(url);

    if (!result.success) {
      this.storage.incrementErrors();
      this.storage.incrementUrlError(url);
      if (result.failureReason) this.storage.incrementFailureReason(result.failureReason);
      // 認証系の失敗時は一定時間のクールダウンを設定
      if (result.failureReason === 'auth') {
        const mins = config.auth?.cooldownMinutes ?? 15;
        this.urlCooldownUntil.set(url, Date.now() + mins * 60 * 1000);
      }
      // 履歴に記録
      this.addUrlCheckHistory(url, { time: timeStr, status: 'エラー' });

      // URL別のエラーカウントを更新
      const currentErrorCount = (this.urlErrorCounts.get(url) || 0) + 1;
      this.urlErrorCounts.set(url, currentErrorCount);

      // 3回連続エラー（15分間）の場合のみ警告通知
      if (telegramEnabled && currentErrorCount >= this.maxUrlConsecutiveErrors) {
        const reason = result.failureReason ? `（理由: ${result.failureReason}）` : '';
        await this.telegram.sendErrorAlert(
          url,
          `15分間継続エラー${reason}: ${result.error || '不明なエラー'}`
        );
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

    // ハッシュ値の管理（RFP 2.1.1準拠: コンテンツ変更検知）
    const previousHash = this.storage.getHash(url);
    if (!previousHash) {
      // 初回チェック
      vibeLogger.info('monitoring.initial_url_check', `初回チェック完了: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
      this.storage.setHash(url, result.hash);
    } else if (previousHash !== result.hash) {
      // ハッシュ変化検知！（新着あり）
      this.addUrlCheckHistory(url, { time: timeStr, status: 'あり' });
      vibeLogger.info('monitoring.change_detected', `🎉 変化検知: ${url}`, {
        context: {
          url,
          previousHash,
          newHash: result.hash,
          count: result.count,
        },
        humanNote: 'コンテンツの変更を検知しました！',
      });
      this.storage.incrementNewListings();
      this.storage.recordUrlNewProperty(url, 1);

      // 新着通知を送信
      if (telegramEnabled) {
        const message = `🆕 新着があります！\n\nURL: ${url}\n検知時刻: ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;
        await this.telegram.sendMessage(message);
      }
      // ハッシュを更新
      this.storage.setHash(url, result.hash);
    } else {
      // 変化なし
      this.addUrlCheckHistory(url, { time: timeStr, status: 'なし' });
      vibeLogger.debug('monitoring.no_change', `変化なし: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
      // 変化がなくても念のためハッシュを保存（整合性のため）
      this.storage.setHash(url, result.hash);
    }
  }

  /**
   * URL チェック履歴を追加
   */
  private addUrlCheckHistory(
    url: string,
    entry: { time: string; status: 'なし' | 'あり' | 'エラー' }
  ): void {
    if (!this.urlCheckHistory.has(url)) {
      this.urlCheckHistory.set(url, []);
    }
    const history = this.urlCheckHistory.get(url)!;
    history.push(entry);

    // 1時間分（12エントリー = 5分×12）を超えたら古いものを削除
    if (history.length > 12) {
      history.shift();
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
  private getUrlStatistics(url: string): import('./types.js').UrlStatistics {
    return this.storage.getUrlStats(url);
  }

  /**
   * URLごとのサマリーレポートを送信
   */
  private async sendUrlSummaryReports(
    urls: string[],
    telegramEnabled: boolean = true
  ): Promise<void> {
    if (!telegramEnabled) {
      return;
    }

    for (const url of urls) {
      try {
        const urlStats = this.getUrlStatistics(url);
        // 履歴を追加
        urlStats.hourlyHistory = this.urlCheckHistory.get(url) || [];
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
  private async sendStatisticsReport(
    telegramEnabled: boolean = true,
    urls: string[] = []
  ): Promise<void> {
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
   * Telegramインスタンスを取得
   */
  getTelegram(): TelegramNotifier {
    return this.telegram;
  }

  /**
   * 現在のステータスを取得
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    urlCount: number;
    lastCheck: Date | null;
    totalChecks: number;
    successRate: number;
  }> {
    const stats = await this.storage.getStatistics();
    const urls = this.monitoringUrls;

    return {
      isRunning: this.isRunning,
      urlCount: urls.length,
      lastCheck: stats.lastCheck,
      totalChecks: stats.totalChecks,
      successRate: stats.successRate,
    };
  }

  /**
   * 手動チェック実行
   */
  async runManualCheck(): Promise<{
    urlCount: number;
    successCount: number;
    errorCount: number;
    newPropertyCount: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const urls = this.monitoringUrls;

    vibeLogger.info('monitoring.manual_check_start', '手動チェック開始', {
      context: { urlCount: urls.length },
    });

    let successCount = 0;
    let errorCount = 0;
    let newPropertyCount = 0;

    for (const url of urls) {
      try {
        const result = await this.scraper.scrapeAthome(url);
        if (result.success) {
          successCount++;

          // 新着物件チェック
          const detectionResult = this.propertyMonitor.detectNewProperties(result.properties || []);
          if (detectionResult.hasNewProperty) {
            newPropertyCount += detectionResult.newPropertyCount;
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        vibeLogger.error('monitoring.manual_check_error', '手動チェックエラー', {
          context: {
            url,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    const executionTime = Date.now() - startTime;

    vibeLogger.info('monitoring.manual_check_complete', '手動チェック完了', {
      context: {
        urlCount: urls.length,
        successCount,
        errorCount,
        newPropertyCount,
        executionTime,
      },
    });

    return {
      urlCount: urls.length,
      successCount,
      errorCount,
      newPropertyCount,
      executionTime,
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

/**
 * マルチユーザー対応監視スケジューラー
 *
 * @設計ドキュメント
 * - README.md: 監視フロー全体像
 * - docs/スケジューリング設計.md: cron式と実行タイミング
 *
 * @関連クラス
 * - SimpleScraper: 実際のスクレイピング処理を実行（Puppeteer-first戦略）
 * - UserService: ユーザー・URL管理
 * - TelegramNotifier: ユーザー別通知送信
 * - Logger: 監視サイクルのログ出力
 *
 * @主要機能
 * - 全ユーザーのアクティブURL監視
 * - ユーザー別新着物件通知
 * - URL別統計管理
 * - Telegram友達認証制御
 */
/**
 * マルチユーザー対応監視スケジューラー
 *
 * @設計ドキュメント
 * - README.md: 監視フロー全体像
 * - docs/スケジューリング設計.md: cron式と実行タイミング
 *
 * @関連クラス
 * - SimpleScraper: 実際のスクレイピング処理を実行（Puppeteer-first戦略）
 * - UserService: ユーザー・URL管理
 * - TelegramNotifier: ユーザー別通知送信
 * - Logger: 監視サイクルのログ出力
 *
 * @主要機能
 * - 全ユーザーのアクティブURL監視
 * - ユーザー別新着物件通知
 * - URL別統計管理
 * - Telegram友達認証制御
 */
export class MultiUserMonitoringScheduler {
  private readonly scraper = new SimpleScraper();
  private readonly userService: UserService;
  /**
   * UserServiceを取得
   */
  getUserService() {
    return this.userService;
  }
  private readonly propertyMonitor = new PropertyMonitor();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly telegramServices: Map<string, TelegramNotifier> = new Map();

  // 5分ごとの履歴管理機能を追加
  private readonly urlHistory: Map<
    string,
    Array<{ time: string; status: 'なし' | 'あり' | 'エラー' }>
  > = new Map();

  private cronJob: cron.ScheduledTask | null = null;
  private statsJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;
  private readonly urlErrorCounts: Map<string, number> = new Map();

  // 集計用（/status, /stats応答向けの簡易統計）
  private readonly aggregate = {
    totalChecks: 0,
    successCount: 0,
    errorCount: 0,
    totalCycleExecutionMs: 0,
    lastCheck: null as Date | null,
  };

  constructor() {
    this.userService = new UserService();

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
   * MarkdownV2用エスケープ処理
   */
  private escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  /**
   * マルチユーザー監視開始
   */
  async start(): Promise<void> {
    vibeLogger.info('multiuser.monitoring.start', 'マルチユーザー監視開始', {
      context: { mode: 'multiuser' },
      humanNote: 'マルチユーザーモードでシステムを開始',
    });

    // データベース接続確認
    await this.initializeDatabase();

    // 監視間隔は設定から取得（デフォルト5分）
    this.cronJob = cron.schedule(config.monitoring.interval || '*/5 * * * *', () => {
      if (this.isRunning) {
        vibeLogger.warn(
          'multiuser.monitoring.skip',
          '前回の監視がまだ実行中です。スキップします。',
          {
            context: { isRunning: this.isRunning },
            aiTodo: '監視サイクルが遅延している可能性を分析',
          }
        );
        return;
      }

      void this.runMonitoringCycle();
    });

    // 統計レポート送信（毎時20分・固定）
    this.statsJob = cron.schedule('0 * * * *', () => {
      void this.sendAllUsersStatisticsReport();
    });

    // 初回実行
    vibeLogger.info('multiuser.monitoring.initial_check', '初回チェックを実行します...', {});
    await this.runMonitoringCycle();
    vibeLogger.info('multiuser.monitoring.initial_check_complete', '初回チェック完了', {
      humanNote: 'マルチユーザーシステムが正常に稼働開始',
    });
  }

  /**
   * データベース初期化確認
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // UserServiceを通じてデータベース接続をテスト
      await this.userService.getAllUsers();
      vibeLogger.info('multiuser.db.connected', 'データベース接続確認完了', {
        humanNote: 'データベースが正常に接続されました',
      });
    } catch (error) {
      vibeLogger.error('multiuser.db.connection_failed', 'データベース接続失敗', {
        context: { error: error instanceof Error ? error.message : String(error) },
        aiTodo: 'データベース設定を確認し、接続問題を解決',
      });
      throw new Error('データベース接続に失敗しました');
    }
  }

  /**
   * マルチユーザー監視サイクル実行
   */
  private async runMonitoringCycle(): Promise<void> {
    // サーキットブレーカーがOPENの場合はスキップ
    if (this.circuitBreaker.isOpen()) {
      vibeLogger.warn(
        'multiuser.monitoring.cycle.skipped',
        'サーキットブレーカーが作動中のため監視をスキップ',
        {
          context: this.circuitBreaker.getStats(),
        }
      );
      return;
    }

    this.isRunning = true;
    const cycleStartTime = Date.now();

    const cycleId = `multiuser-cycle-${Date.now()}`;
    vibeLogger.info('multiuser.monitoring.cycle.start', 'マルチユーザー監視サイクル開始', {
      context: {
        cycleId,
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      },
    });

    try {
      // 全ユーザーのアクティブ監視URLを取得
      const activeUrls = await this.userService.getAllActiveMonitoringUrls();

      vibeLogger.info('multiuser.monitoring.urls_loaded', '監視対象URL読み込み完了', {
        context: { activeUrlCount: activeUrls.length },
      });

      let successCount = 0;
      let errorCount = 0;

      for (const userUrl of activeUrls) {
        try {
          await this.monitorUserUrl(userUrl);
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

          if (shouldStop) {
            // サーキットブレーカーが作動した場合、管理者に通知
            const telegram = this.getTelegramService(userUrl.user.telegramChatId);
            if (telegram) {
              const escapedErrorMsg = this.escapeMarkdownV2(errorMessage);
              const recoveryMsg = config.circuitBreaker.autoRecoveryEnabled
                ? `⏱ ${config.circuitBreaker.recoveryTimeMinutes}分後に自動復旧を試みます`
                : '手動での復旧が必要です';

              await telegram.sendMessage(
                `🚨 エラー頻発により監視を一時停止しました

連続エラー: ${this.consecutiveErrors}回
詳細: ${escapedErrorMsg}

${this.escapeMarkdownV2(recoveryMsg)}`
              );
            }
          }

          vibeLogger.error('multiuser.monitoring.url.error', `ユーザーURL監視エラー`, {
            context: {
              urlId: userUrl.id,
              userId: userUrl.userId,
              url: userUrl.url,
              error: error instanceof Error ? error.message : String(error),
              consecutiveErrors: this.consecutiveErrors,
            },
            aiTodo: 'エラーパターンを分析し、対策を提案',
          });
        }
      }

      const cycleTime = Date.now() - cycleStartTime;
      vibeLogger.info('multiuser.monitoring.cycle.complete', 'マルチユーザー監視サイクル完了', {
        context: {
          cycleId,
          cycleTime,
          successCount,
          errorCount,
          totalUrls: activeUrls.length,
          successRate:
            activeUrls.length > 0 ? Math.round((successCount / activeUrls.length) * 100) : 0,
        },
        humanNote: 'マルチユーザー監視サイクルのパフォーマンスを確認',
      });

      // 集計を更新
      this.aggregate.totalChecks += activeUrls.length;
      this.aggregate.successCount += successCount;
      this.aggregate.errorCount += errorCount;
      this.aggregate.totalCycleExecutionMs += cycleTime;
      this.aggregate.lastCheck = new Date();
    } catch (error) {
      vibeLogger.error('multiuser.monitoring.cycle.error', '監視サイクル実行エラー', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 現在のステータスを取得（Telegram /status 用）
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    urlCount: number;
    lastCheck: Date | null;
    totalChecks: number;
    successRate: number;
  }> {
    const urls = await this.userService.getAllActiveMonitoringUrls();
    const denom = this.aggregate.successCount + this.aggregate.errorCount;
    const successRate = denom > 0 ? (this.aggregate.successCount / denom) * 100 : 0;
    return {
      isRunning: this.isRunning,
      urlCount: urls.length,
      lastCheck: this.aggregate.lastCheck,
      totalChecks: this.aggregate.totalChecks,
      successRate: Number(successRate.toFixed(2)),
    };
  }

  /**
   * 統計情報を取得（Telegram /stats 用）
   */
  getStatistics(): import('./types.js').Statistics {
    const monitoringStats = this.propertyMonitor.getMonitoringStatistics();
    const denom = this.aggregate.successCount + this.aggregate.errorCount;
    const successRate = denom > 0 ? (this.aggregate.successCount / denom) * 100 : 0;
    const avgExecSec =
      this.aggregate.totalChecks > 0
        ? this.aggregate.totalCycleExecutionMs / Math.max(this.aggregate.totalChecks, 1) / 1000
        : 0;

    return {
      totalChecks: this.aggregate.totalChecks,
      errors: this.aggregate.errorCount,
      newListings: monitoringStats.newPropertyDetections,
      lastCheck: this.aggregate.lastCheck || monitoringStats.lastCheckAt || new Date(),
      averageExecutionTime: Number(avgExecSec.toFixed(2)),
      successRate: Number(successRate.toFixed(2)),
    };
  }

  /**
   * ユーザーURL監視
   */
  private async monitorUserUrl(userUrl: import('./entities/UserUrl.js').UserUrl): Promise<void> {
    vibeLogger.info('multiuser.monitoring.user_url.check', `ユーザーURL監視開始`, {
      context: {
        urlId: userUrl.id,
        userId: userUrl.userId,
        url: userUrl.url,
        name: userUrl.name,
      },
    });

    const result = await this.scraper.scrapeAthome(userUrl.url);

    // 5分ごとの履歴記録を追加
    const urlKey = `${userUrl.userId}-${userUrl.id}`;
    const currentTime = new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (!result.success) {
      // エラー履歴を記録
      this.addUrlHistory(urlKey, currentTime, 'エラー');

      // エラー統計を更新
      await this.updateUrlError(userUrl);

      // URL別のエラーカウントを更新
      const currentErrorCount = (this.urlErrorCounts.get(urlKey) || 0) + 1;
      this.urlErrorCounts.set(urlKey, currentErrorCount);

      // 3回連続エラー（15分間）の場合のみ警告通知
      if (currentErrorCount >= 3) {
        const telegram = this.getTelegramService(userUrl.user.telegramChatId);
        if (telegram) {
          const reason = result.failureReason ? `（理由: ${result.failureReason}）` : '';
          await telegram.sendErrorAlert(
            userUrl.url,
            `15分間継続エラー${reason}: ${result.error || '不明なエラー'}`,
            userUrl.name
          );
        }
        // 通知後はカウンターをリセット
        this.urlErrorCounts.set(urlKey, 0);
      }
      return;
    }

    // 成功時はURLのエラーカウンターをリセット
    this.urlErrorCounts.set(urlKey, 0);

    // URL統計を更新
    await this.updateUrlSuccess(userUrl);

    // ハッシュ値の管理（RFP 2.1.1準拠: コンテンツ変更検知）
    const previousHash = userUrl.lastHash;
    if (!previousHash) {
      // 初回チェック
      this.addUrlHistory(urlKey, currentTime, 'なし');
      vibeLogger.info('multiuser.monitoring.initial_url_check', `初回チェック完了`, {
        context: {
          urlId: userUrl.id,
          userId: userUrl.userId,
          url: userUrl.url,
          count: result.count,
          hash: result.hash,
        },
      });
      await this.updateUrlHash(userUrl, result.hash);
    } else if (previousHash !== result.hash) {
      // ハッシュ変化検知！（新着あり）
      this.addUrlHistory(urlKey, currentTime, 'あり');
      vibeLogger.info('multiuser.monitoring.change_detected', `🎉 変化検知`, {
        context: {
          urlId: userUrl.id,
          userId: userUrl.userId,
          url: userUrl.url,
          previousHash,
          newHash: result.hash,
          count: result.count,
        },
        humanNote: 'ユーザーURLでコンテンツの変更を検知しました！',
      });

      // 新着カウントを更新
      await this.updateUrlNewProperty(userUrl);

      // ユーザー個別通知を送信
      const telegram = this.getTelegramService(userUrl.user.telegramChatId);
      if (telegram) {
        const escapedName = this.escapeMarkdownV2(userUrl.name);
        const currentTimeStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const escapedTime = this.escapeMarkdownV2(currentTimeStr);

        const message = `🆕 新着があります！

📍 監視名: [${escapedName}](http://localhost:3005)
検知時刻: ${escapedTime}`;
        await telegram.sendMessage(message);
      }

      // ハッシュを更新
      await this.updateUrlHash(userUrl, result.hash);
    } else {
      // 変化なし
      this.addUrlHistory(urlKey, currentTime, 'なし');
      vibeLogger.debug('multiuser.monitoring.no_change', `変化なし`, {
        context: {
          urlId: userUrl.id,
          userId: userUrl.userId,
          url: userUrl.url,
          count: result.count,
          hash: result.hash,
        },
      });
      // 変化がなくても念のためハッシュを保存（整合性のため）
      await this.updateUrlHash(userUrl, result.hash);
    }
  }

  /**
   * URL履歴記録（5分ごと）
   */
  private addUrlHistory(urlKey: string, time: string, status: 'なし' | 'あり' | 'エラー'): void {
    if (!this.urlHistory.has(urlKey)) {
      this.urlHistory.set(urlKey, []);
    }

    const history = this.urlHistory.get(urlKey)!;
    history.push({ time, status });

    // 過去1時間（12回分）のデータのみ保持
    if (history.length > 12) {
      history.shift();
    }
  }

  /**
   * Telegramサービス取得（ユーザー別）
   */
  private getTelegramService(chatId: string): TelegramNotifier | null {
    if (this.telegramServices.has(chatId)) {
      return this.telegramServices.get(chatId)!;
    }

    // Telegram友達チェック（認証）
    if (!this.checkTelegramFriendship(chatId)) {
      vibeLogger.warn('multiuser.auth.not_friend', 'Telegram友達でないユーザーからのアクセス', {
        context: { chatId },
        humanNote: '認証されていないユーザーのアクセスを拒否',
      });
      return null;
    }

    // 新しいTelegramサービスを作成
    const telegram = new TelegramNotifier(config.telegram.botToken, chatId);
    this.telegramServices.set(chatId, telegram);
    return telegram;
  }

  /**
   * Telegram友達関係チェック（認証）
   */
  private checkTelegramFriendship(chatId: string): boolean {
    try {
      // TODO: 実際のTelegram友達チェック実装
      // 現在は全てのユーザーを許可（開発用）
      return true;
    } catch (error) {
      vibeLogger.error('multiuser.auth.check_failed', 'Telegram友達チェック失敗', {
        context: { chatId, error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  /**
   * URL統計更新（エラー）
   */
  private async updateUrlError(userUrl: import('./entities/UserUrl.js').UserUrl): Promise<void> {
    await this.userService.incrementUrlStatistics(userUrl.id, 'totalChecks');
    await this.userService.incrementUrlStatistics(userUrl.id, 'errorCount');
  }

  /**
   * URL統計更新（成功）
   */
  private async updateUrlSuccess(userUrl: import('./entities/UserUrl.js').UserUrl): Promise<void> {
    await this.userService.incrementUrlStatistics(userUrl.id, 'totalChecks');
  }

  /**
   * URLハッシュ更新
   */
  private async updateUrlHash(
    userUrl: import('./entities/UserUrl.js').UserUrl,
    hash: string
  ): Promise<void> {
    await this.userService.updateUrlStatistics(userUrl.id, {
      lastHash: hash,
      lastCheckedAt: new Date(),
    });
  }

  /**
   * URL新着カウント更新
   */
  private async updateUrlNewProperty(
    userUrl: import('./entities/UserUrl.js').UserUrl
  ): Promise<void> {
    await this.userService.incrementUrlStatistics(userUrl.id, 'newListingsCount');
  }

  /**
   * 全ユーザー統計レポート送信
   */
  private async sendAllUsersStatisticsReport(): Promise<void> {
    try {
      const users = await this.userService.getAllUsers();

      for (const user of users) {
        if (!user.isActive) continue;

        const telegram = this.getTelegramService(user.telegramChatId);
        if (!telegram) continue;

        // ユーザーのURL統計を取得してレポート送信
        for (const url of user.urls.filter((u: any) => u.isActive)) {
          const urlKey = `${user.id}-${url.id}`;
          const urlStats = {
            url: url.url,
            name: url.name,
            totalChecks: url.totalChecks,
            successCount: url.totalChecks - url.errorCount,
            errorCount: url.errorCount,
            successRate:
              url.totalChecks > 0
                ? Math.round(((url.totalChecks - url.errorCount) / url.totalChecks) * 100)
                : 0,
            averageExecutionTime: 0, // 簡易実装
            hasNewProperty: url.newListingsCount > 0,
            newPropertyCount: url.newListingsCount,
            lastNewProperty: url.lastCheckedAt || null,
            hourlyHistory: this.urlHistory.get(urlKey) || [], // 履歴データを追加
          };

          await telegram.sendUrlSummaryReport(urlStats);

          vibeLogger.info('multiuser.url_report_sent', 'ユーザー別URL統計レポート送信完了', {
            context: { userId: user.id, urlId: url.id, stats: urlStats },
          });
        }
      }
    } catch (error) {
      vibeLogger.error('multiuser.stats_report_error', '全ユーザー統計レポート送信エラー', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * 監視停止
   */
  stop(): void {
    vibeLogger.info('multiuser.monitoring.stopping', 'マルチユーザー監視停止中...', {
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

    vibeLogger.info('multiuser.monitoring.stopped', 'マルチユーザー監視停止完了', {
      humanNote: 'システムが正常に停止しました',
    });
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
