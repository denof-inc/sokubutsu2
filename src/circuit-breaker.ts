import { vibeLogger } from './logger.js';

/**
 * サーキットブレーカー設定
 */
export interface CircuitBreakerConfig {
  /** 連続エラー許容回数 */
  maxConsecutiveErrors: number;
  /** エラー率閾値（0-1） */
  errorRateThreshold: number;
  /** 監視時間窓（ミリ秒） */
  windowSizeMs: number;
  /** 自動復旧までの待機時間（ミリ秒） */
  recoveryTimeMs: number;
  /** 自動復旧を有効にするか */
  autoRecoveryEnabled: boolean;
}

/**
 * サーキットブレーカーの状態
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // 正常稼働中
  OPEN = 'OPEN', // 停止中
  HALF_OPEN = 'HALF_OPEN', // 復旧試行中
}

/**
 * エラー記録
 */
interface ErrorRecord {
  timestamp: number;
  message: string;
}

/**
 * サーキットブレーカー実装
 * 
 * @設計ドキュメント
 * - エラーが頻発した際に自動的にサービスを停止
 * - 設定可能な閾値でエラー監視
 * - 自動復旧機能付き
 * 
 * @関連クラス
 * - MonitoringScheduler: このクラスを使用してエラー監視
 * - TelegramNotifier: エラー時の通知
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveErrors = 0;
  private errorHistory: ErrorRecord[] = [];
  private lastOpenTime = 0;
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * 成功を記録
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // 復旧試行が成功した場合、完全に復旧
      this.state = CircuitState.CLOSED;
      vibeLogger.info('circuit-breaker.recovered', 'サーキットブレーカーが復旧しました', {
        context: { previousErrors: this.consecutiveErrors },
      });
    }
    
    this.consecutiveErrors = 0;
    // 古いエラー履歴をクリーンアップ
    this.cleanupErrorHistory();
  }

  /**
   * エラーを記録
   */
  recordError(error: string): boolean {
    this.consecutiveErrors++;
    this.errorHistory.push({
      timestamp: Date.now(),
      message: error,
    });

    this.cleanupErrorHistory();

    // 連続エラー数チェック
    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.trip('連続エラー数が閾値を超えました');
      return true;
    }

    // エラー率チェック
    const errorRate = this.calculateErrorRate();
    if (errorRate >= this.config.errorRateThreshold) {
      this.trip(`エラー率が閾値を超えました: ${(errorRate * 100).toFixed(1)}%`);
      return true;
    }

    return false;
  }

  /**
   * サーキットブレーカーを開く（停止）
   */
  private trip(reason: string): void {
    if (this.state === CircuitState.OPEN) {
      return; // すでに開いている
    }

    this.state = CircuitState.OPEN;
    this.lastOpenTime = Date.now();

    vibeLogger.error('circuit-breaker.tripped', 'サーキットブレーカーが作動しました', {
      context: {
        reason,
        consecutiveErrors: this.consecutiveErrors,
        errorRate: this.calculateErrorRate(),
        recentErrors: this.errorHistory.slice(-5),
      },
      humanNote: '監視を一時停止します',
      aiTodo: 'エラーパターンを分析して根本原因を特定',
    });

    // 自動復旧の設定
    if (this.config.autoRecoveryEnabled) {
      this.scheduleRecovery();
    }
  }

  /**
   * 自動復旧のスケジュール
   */
  private scheduleRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      this.attemptRecovery();
    }, this.config.recoveryTimeMs);

    const recoveryTimeMinutes = Math.round(this.config.recoveryTimeMs / 60000);
    vibeLogger.info('circuit-breaker.recovery-scheduled', `${recoveryTimeMinutes}分後に自動復旧を試みます`, {
      context: { recoveryTimeMs: this.config.recoveryTimeMs },
    });
  }

  /**
   * 復旧を試みる
   */
  attemptRecovery(): void {
    if (this.state !== CircuitState.OPEN) {
      return;
    }

    this.state = CircuitState.HALF_OPEN;
    this.consecutiveErrors = 0;

    vibeLogger.info('circuit-breaker.attempting-recovery', '復旧を試みています', {
      context: { downTimeMs: Date.now() - this.lastOpenTime },
    });
  }

  /**
   * 手動でリセット
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveErrors = 0;
    this.errorHistory = [];
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    vibeLogger.info('circuit-breaker.reset', 'サーキットブレーカーを手動でリセットしました');
  }

  /**
   * 現在の状態を取得
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * サーキットが開いているか確認
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * 実行可能か確認
   */
  canExecute(): boolean {
    return this.state !== CircuitState.OPEN;
  }

  /**
   * エラー率を計算
   */
  private calculateErrorRate(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;
    
    // 時間窓内のエラーを取得
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= windowStart);
    
    // 最小10回のチェックがないとエラー率を計算しない
    const minChecks = 10;
    if (recentErrors.length < minChecks) {
      return 0;
    }

    // エラー率を概算（エラー数 / 想定チェック回数）
    // 5分間隔なので、時間窓内の想定チェック回数を計算
    const expectedChecks = Math.floor(this.config.windowSizeMs / (5 * 60 * 1000));
    const errorRate = Math.min(1, recentErrors.length / Math.max(expectedChecks, minChecks));

    return errorRate;
  }

  /**
   * 古いエラー履歴をクリーンアップ
   */
  private cleanupErrorHistory(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;
    this.errorHistory = this.errorHistory.filter(e => e.timestamp >= windowStart);
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    state: CircuitState;
    consecutiveErrors: number;
    errorRate: number;
    recentErrorCount: number;
    lastOpenTime: number;
  } {
    return {
      state: this.state,
      consecutiveErrors: this.consecutiveErrors,
      errorRate: this.calculateErrorRate(),
      recentErrorCount: this.errorHistory.length,
      lastOpenTime: this.lastOpenTime,
    };
  }
}