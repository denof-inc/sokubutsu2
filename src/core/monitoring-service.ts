/**
 * 監視サービス
 *
 * @設計ドキュメント
 * - docs/監視フロー設計.md: 監視処理の詳細
 * - docs/システム設計書.md: 監視戦略
 *
 * @関連クラス
 * - IScrapingService: スクレイピング処理の実行
 * - IStorageService: ハッシュ値の保存と統計管理
 * - INotificationService: 通知の送信
 * - vibeLogger: 監視状況のログ出力
 */

import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';
import { NotificationData } from '../types';
import {
  IMonitoringService,
  IScrapingService,
  IStorageService,
  INotificationService,
} from './interfaces';

export class MonitoringService implements IMonitoringService {
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;

  constructor(
    private readonly scrapingService: IScrapingService,
    private readonly storageService: IStorageService,
    private readonly notificationService: INotificationService
  ) {}

  /**
   * URLの監視を実行
   */
  async monitorUrl(url: string): Promise<void> {
    vibeLogger.info('monitoring.url.check', `チェック開始: ${url}`, {
      context: { url },
    });

    this.storageService.incrementTotalChecks();

    const result = await this.scrapingService.scrapeAthome(url);

    if (!result.success) {
      this.storageService.incrementErrors();
      await this.notificationService.sendErrorAlert(url, result.error || '不明なエラー');
      throw new Error(result.error || '不明なエラー');
    }

    // 実行時間を記録
    if (result.executionTime) {
      this.storageService.recordExecutionTime(result.executionTime);
    }

    const previousHash = this.storageService.getHash(url);

    if (!previousHash) {
      // 初回チェック
      vibeLogger.info('monitoring.initial_url_check', `初回チェック完了: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
      this.storageService.setHash(url, result.hash);
    } else if (previousHash !== result.hash) {
      // 新着検知！
      vibeLogger.info('monitoring.new_listing_detected', `🎉 新着検知: ${url}`, {
        context: {
          url,
          count: result.count,
          previousHash,
          newHash: result.hash,
        },
        humanNote: '新着物件を検知しました！',
        aiTodo: '検知パターンを分析し、通知タイミングを最適化',
      });
      this.storageService.incrementNewListings();

      // 前回の物件数を推定（簡易実装）
      const previousCount = await this.estimatePreviousCount(url);

      const notificationData: NotificationData = {
        currentCount: result.count,
        previousCount,
        detectedAt: new Date(),
        url,
        executionTime: (result.executionTime || 0) / 1000,
      };

      await this.notificationService.sendNewListingNotification(notificationData);
      this.storageService.setHash(url, result.hash);
    } else {
      // 変化なし
      vibeLogger.debug('monitoring.no_change', `変化なし: ${url}`, {
        context: { url, count: result.count, hash: result.hash },
      });
    }
  }

  /**
   * 監視サイクルを実行
   */
  async runCycle(urls: string[]): Promise<void> {
    if (this.isRunning) {
      vibeLogger.warn('monitoring.skip', '前回の監視がまだ実行中です。スキップします。', {
        context: { isRunning: this.isRunning },
        aiTodo: '監視サイクルが遅延している可能性を分析',
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
            error: formatError(error),
            consecutiveErrors: this.consecutiveErrors,
          },
          aiTodo: 'エラーパターンを分析し、対策を提案',
        });

        // 連続エラーが多い場合は警告
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          await this.notificationService.sendErrorAlert(
            url,
            `連続エラー${this.consecutiveErrors}回`
          );
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
   * 監視ステータスを取得
   */
  getStatus(): { isRunning: boolean; consecutiveErrors: number } {
    return {
      isRunning: this.isRunning,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * 前回の物件数を推定（簡易実装）
   */
  private async estimatePreviousCount(url: string): Promise<number> {
    // 実際の実装では、ハッシュと物件数の対応を保存することを推奨
    // ここでは簡易的に現在の物件数から推定
    try {
      const currentResult = await this.scrapingService.scrapeAthome(url);
      return currentResult.success ? Math.max(0, currentResult.count - 1) : 0;
    } catch (error) {
      vibeLogger.error('monitoring.estimate_count_error', '前回の物件数推定エラー', {
        context: { url, error: formatError(error) },
      });
      return 0;
    }
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
