import { Injectable, Logger } from '@nestjs/common';
import {
  ScrapingError,
  ErrorClassifier,
  BotDetectionError,
  NetworkError,
  TimeoutError,
  BrowserError,
  ResourceLimitError,
} from '../errors/scraping-error';
import { Page } from 'playwright';

interface RecoveryStrategy {
  name: string;
  execute: (
    error: ScrapingError,
    context: RecoveryContext,
  ) => Promise<RecoveryResult>;
  applicable: (error: ScrapingError) => boolean;
}

interface RecoveryContext {
  url: string;
  selector?: string;
  attemptNumber: number;
  page?: Page;
  additionalContext?: Record<string, any>;
}

interface RecoveryResult {
  success: boolean;
  shouldRetry: boolean;
  newStrategy?: string;
  delay?: number;
  message?: string;
}

interface RecoveryStats {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoveryStrategies: Record<
    string,
    {
      attempts: number;
      successes: number;
      failures: number;
    }
  >;
}

@Injectable()
export class AutoRecoveryService {
  private readonly logger = new Logger(AutoRecoveryService.name);
  private readonly strategies: RecoveryStrategy[] = [];
  private readonly stats: RecoveryStats = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    recoveryStrategies: {},
  };

  constructor() {
    this.initializeStrategies();
  }

  /**
   * リカバリー戦略の初期化
   */
  private initializeStrategies(): void {
    this.strategies.push(
      // Bot検知回復戦略
      {
        name: 'bot_detection_recovery',
        applicable: (error) => error instanceof BotDetectionError,
        execute: async (error, context) =>
          this.recoverFromBotDetection(error as BotDetectionError, context),
      },

      // ネットワークエラー回復戦略
      {
        name: 'network_error_recovery',
        applicable: (error) => error instanceof NetworkError,
        execute: async (error, context) =>
          this.recoverFromNetworkError(error as NetworkError, context),
      },

      // タイムアウト回復戦略
      {
        name: 'timeout_recovery',
        applicable: (error) => error instanceof TimeoutError,
        execute: async (error, context) =>
          this.recoverFromTimeout(error as TimeoutError, context),
      },

      // ブラウザエラー回復戦略
      {
        name: 'browser_error_recovery',
        applicable: (error) => error instanceof BrowserError,
        execute: async (error, context) =>
          this.recoverFromBrowserError(error as BrowserError, context),
      },

      // リソース制限回復戦略
      {
        name: 'resource_limit_recovery',
        applicable: (error) => error instanceof ResourceLimitError,
        execute: async (error, context) =>
          this.recoverFromResourceLimit(error as ResourceLimitError, context),
      },
    );
  }

  /**
   * エラーからの自動回復を試行
   */
  async attemptRecovery(
    error: Error,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    this.stats.totalAttempts++;

    // エラーを分類
    const scrapingError =
      error instanceof ScrapingError ? error : ErrorClassifier.classify(error);

    this.logger.warn(
      `Attempting recovery for ${scrapingError.code}: ${scrapingError.message}`,
    );

    // 適用可能な戦略を見つける
    const strategy = this.strategies.find((s) => s.applicable(scrapingError));

    if (!strategy) {
      this.logger.error(
        `No recovery strategy found for error: ${scrapingError.code}`,
      );
      this.stats.failedRecoveries++;
      return {
        success: false,
        shouldRetry: false,
        message: 'No applicable recovery strategy',
      };
    }

    // 戦略統計の初期化
    if (!this.stats.recoveryStrategies[strategy.name]) {
      this.stats.recoveryStrategies[strategy.name] = {
        attempts: 0,
        successes: 0,
        failures: 0,
      };
    }

    this.stats.recoveryStrategies[strategy.name].attempts++;

    try {
      // リカバリー戦略の実行
      const result = await strategy.execute(scrapingError, context);

      if (result.success) {
        this.stats.successfulRecoveries++;
        this.stats.recoveryStrategies[strategy.name].successes++;
        this.logger.log(`Recovery successful using ${strategy.name}`);
      } else {
        this.stats.failedRecoveries++;
        this.stats.recoveryStrategies[strategy.name].failures++;
        this.logger.warn(`Recovery failed using ${strategy.name}`);
      }

      return result;
    } catch (recoveryError) {
      this.logger.error(
        `Recovery strategy ${strategy.name} threw error:`,
        recoveryError,
      );
      this.stats.failedRecoveries++;
      this.stats.recoveryStrategies[strategy.name].failures++;

      return {
        success: false,
        shouldRetry: false,
        message: `Recovery strategy failed: ${recoveryError.message}`,
      };
    }
  }

  /**
   * Bot検知からの回復
   */
  private async recoverFromBotDetection(
    error: BotDetectionError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    const metadata = error.metadata || {};
    const detectionType = metadata.detectionType || 'unknown';

    switch (detectionType) {
      case 'captcha':
        // CAPTCHA検出時の回復戦略
        return {
          success: true,
          shouldRetry: true,
          newStrategy: 'google_access', // Google経由でアクセスを試みる
          delay: 30000, // 30秒待機
          message:
            'Switching to Google access strategy after CAPTCHA detection',
        };

      case 'block':
        // ブロック時の回復戦略
        if (context.attemptNumber < 2) {
          return {
            success: true,
            shouldRetry: true,
            newStrategy: 'stealth_enhanced', // より高度なステルス設定
            delay: 60000, // 1分待機
            message: 'Applying enhanced stealth measures',
          };
        }
        break;

      case 'challenge':
        // チャレンジ検出時
        return {
          success: true,
          shouldRetry: true,
          delay: 10000,
          message: 'Waiting before retry due to challenge',
        };
    }

    return {
      success: false,
      shouldRetry: false,
      message: 'Unable to recover from bot detection',
    };
  }

  /**
   * ネットワークエラーからの回復
   */
  private async recoverFromNetworkError(
    error: NetworkError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    // DNSエラーの場合
    if (error.message.toLowerCase().includes('dns')) {
      return {
        success: false,
        shouldRetry: false,
        message: 'DNS resolution failed - invalid URL',
      };
    }

    // 接続エラーの場合
    if (context.attemptNumber < 5) {
      const delay = Math.min(1000 * Math.pow(2, context.attemptNumber), 30000);

      return {
        success: true,
        shouldRetry: true,
        delay: delay + Math.random() * 1000, // ジッター追加
        message: `Network error recovery with ${delay}ms delay`,
      };
    }

    return {
      success: false,
      shouldRetry: false,
      message: 'Max network retry attempts exceeded',
    };
  }

  /**
   * タイムアウトからの回復
   */
  private async recoverFromTimeout(
    error: TimeoutError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    // ページロードの最適化
    if (context.attemptNumber === 1) {
      return {
        success: true,
        shouldRetry: true,
        newStrategy: 'lightweight', // 軽量モードで再試行
        delay: 2000,
        message: 'Switching to lightweight mode after timeout',
      };
    }

    // タイムアウト時間の延長
    if (context.attemptNumber < 3) {
      return {
        success: true,
        shouldRetry: true,
        delay: 3000,
        message: 'Retrying with extended timeout',
      };
    }

    return {
      success: false,
      shouldRetry: false,
      message: 'Timeout recovery attempts exhausted',
    };
  }

  /**
   * ブラウザエラーからの回復
   */
  private async recoverFromBrowserError(
    error: BrowserError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    // ブラウザクラッシュの場合
    if (error.message.includes('crashed') || error.message.includes('closed')) {
      return {
        success: true,
        shouldRetry: true,
        delay: 5000,
        message: 'Browser crashed - will retry with new instance',
      };
    }

    // コンテキストエラー
    if (error.message.includes('context')) {
      return {
        success: true,
        shouldRetry: true,
        newStrategy: 'new_context',
        delay: 3000,
        message: 'Creating new browser context',
      };
    }

    return {
      success: false,
      shouldRetry: context.attemptNumber < 2,
      delay: 3000,
      message: 'Browser error recovery',
    };
  }

  /**
   * リソース制限からの回復
   */
  private async recoverFromResourceLimit(
    error: ResourceLimitError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    const metadata = error.metadata || {};
    const resourceType = metadata.resourceType || 'unknown';

    switch (resourceType) {
      case 'memory':
        // メモリ不足の場合
        return {
          success: true,
          shouldRetry: true,
          newStrategy: 'memory_optimized',
          delay: 10000,
          message: 'Switching to memory-optimized mode',
        };

      case 'browser_pool':
        // ブラウザプール枯渇
        return {
          success: true,
          shouldRetry: true,
          delay: 15000, // プールが空くまで待機
          message: 'Waiting for browser pool availability',
        };

      case 'rate_limit': {
        // レート制限
        const backoffDelay = 60000 * (context.attemptNumber + 1); // 1分、2分、3分...
        return {
          success: true,
          shouldRetry: context.attemptNumber < 3,
          delay: backoffDelay,
          message: `Rate limit recovery with ${backoffDelay / 1000}s delay`,
        };
      }

      case 'cpu':
        // CPU使用率高
        return {
          success: true,
          shouldRetry: true,
          delay: 5000,
          message: 'CPU usage high - throttling requests',
        };
    }

    return {
      success: false,
      shouldRetry: false,
      message: 'Resource limit cannot be recovered',
    };
  }

  /**
   * ページ状態の修復
   */
  async repairPageState(page: Page): Promise<boolean> {
    try {
      // JavaScriptエラーのクリア
      await page.evaluate(() => {
        window.onerror = null;
        window.onunhandledrejection = null;
      });

      // 保留中のタイマーのクリア
      await page.evaluate(() => {
        const highestId = setTimeout(() => {}, 0) as any as number;
        for (let i = 0; i < highestId; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
      });

      // メモリの解放を促す
      await page.evaluate(() => {
        if (typeof gc === 'function') {
          gc();
        }
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to repair page state:', error);
      return false;
    }
  }

  /**
   * 統計情報の取得
   */
  getStats(): RecoveryStats {
    return {
      ...this.stats,
      recoveryStrategies: { ...this.stats.recoveryStrategies },
    };
  }

  /**
   * 統計情報のリセット
   */
  resetStats(): void {
    this.stats.totalAttempts = 0;
    this.stats.successfulRecoveries = 0;
    this.stats.failedRecoveries = 0;
    this.stats.recoveryStrategies = {};
  }
}
