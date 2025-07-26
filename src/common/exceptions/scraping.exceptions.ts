/**
 * スクレイピングエラーの基底クラス
 */
export abstract class ScrapingError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context: Record<string, any>;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = false,
    context: Record<string, any> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.recoverable = recoverable;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * エラーの詳細情報を取得
   */
  getDetails(): {
    name: string;
    code: string;
    message: string;
    timestamp: Date;
    recoverable: boolean;
    context: Record<string, any>;
    stack?: string;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * ネットワーク関連エラー
 */
export class NetworkError extends ScrapingError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'NETWORK_ERROR', true, context);
  }
}

/**
 * タイムアウトエラー
 */
export class TimeoutError extends ScrapingError {
  constructor(
    message: string,
    timeoutMs: number,
    context: Record<string, any> = {},
  ) {
    super(message, 'TIMEOUT_ERROR', true, { ...context, timeoutMs });
  }
}

/**
 * Bot検知エラー
 */
export class BotDetectionError extends ScrapingError {
  public readonly detectionType: 'captcha' | 'block' | 'challenge' | 'unknown';

  constructor(
    message: string,
    detectionType: 'captcha' | 'block' | 'challenge' | 'unknown' = 'unknown',
    context: Record<string, any> = {},
  ) {
    super(
      message,
      'BOT_DETECTION_ERROR',
      detectionType === 'captcha', // CAPTCHAの場合は回復可能
      { ...context, detectionType },
    );
    this.detectionType = detectionType;
  }
}

/**
 * コンテンツパースエラー
 */
export class ParsingError extends ScrapingError {
  constructor(
    message: string,
    selector?: string,
    context: Record<string, any> = {},
  ) {
    super(message, 'PARSING_ERROR', false, { ...context, selector });
  }
}

/**
 * ブラウザエラー
 */
export class BrowserError extends ScrapingError {
  constructor(
    message: string,
    browserError?: Error,
    context: Record<string, any> = {},
  ) {
    super(message, 'BROWSER_ERROR', true, {
      ...context,
      originalError: browserError?.message,
      originalStack: browserError?.stack,
    });
  }
}

/**
 * リソース制限エラー
 */
export class ResourceLimitError extends ScrapingError {
  public readonly resourceType:
    | 'memory'
    | 'cpu'
    | 'browser_pool'
    | 'rate_limit';

  constructor(
    message: string,
    resourceType: 'memory' | 'cpu' | 'browser_pool' | 'rate_limit',
    context: Record<string, any> = {},
  ) {
    super(message, 'RESOURCE_LIMIT_ERROR', true, { ...context, resourceType });
    this.resourceType = resourceType;
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends ScrapingError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'AUTHENTICATION_ERROR', false, context);
  }
}

/**
 * データ検証エラー
 */
export class ValidationError extends ScrapingError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{
      field: string;
      message: string;
      value?: any;
    }> = [],
    context: Record<string, any> = {},
  ) {
    super(message, 'VALIDATION_ERROR', false, { ...context, validationErrors });
    this.validationErrors = validationErrors;
  }
}

/**
 * エラー分類ユーティリティ
 */
export class ErrorClassifier {
  /**
   * エラーを分類して適切なScrapingErrorに変換
   */
  static classify(
    error: Error,
    context: Record<string, any> = {},
  ): ScrapingError {
    const message = error.message.toLowerCase();

    // タイムアウト検出
    if (message.includes('timeout') || message.includes('timed out')) {
      const timeoutMatch = message.match(/(\d+)ms/);
      const timeoutMs = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
      return new TimeoutError(error.message, timeoutMs, context);
    }

    // ネットワークエラー検出
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('dns')
    ) {
      return new NetworkError(error.message, context);
    }

    // Bot検知エラー
    if (message.includes('captcha') || message.includes('/sorry/')) {
      return new BotDetectionError(error.message, 'captcha', context);
    }

    if (message.includes('blocked') || message.includes('forbidden')) {
      return new BotDetectionError(error.message, 'block', context);
    }

    // ブラウザエラー
    if (
      message.includes('browser') ||
      message.includes('page') ||
      message.includes('context') ||
      error.name === 'TargetClosedError'
    ) {
      return new BrowserError(error.message, error, context);
    }

    // パースエラー
    if (
      message.includes('selector') ||
      message.includes('element') ||
      message.includes('parse')
    ) {
      return new ParsingError(error.message, undefined, context);
    }

    // デフォルト: 一般的なスクレイピングエラー
    return new (class extends ScrapingError {
      constructor() {
        super(error.message, 'UNKNOWN_ERROR', false, context);
      }
    })();
  }

  /**
   * エラーが回復可能かどうかを判定
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof ScrapingError) {
      return error.recoverable;
    }

    // ScrapingErrorでない場合は分類して判定
    const classified = this.classify(error);
    return classified.recoverable;
  }

  /**
   * リトライ戦略の提案
   */
  static suggestRetryStrategy(error: ScrapingError): {
    shouldRetry: boolean;
    delay: number;
    maxRetries: number;
    strategy: string;
  } {
    if (!error.recoverable) {
      return {
        shouldRetry: false,
        delay: 0,
        maxRetries: 0,
        strategy: 'no_retry',
      };
    }

    switch (error.code) {
      case 'TIMEOUT_ERROR':
        return {
          shouldRetry: true,
          delay: 2000,
          maxRetries: 3,
          strategy: 'exponential_backoff',
        };

      case 'NETWORK_ERROR':
        return {
          shouldRetry: true,
          delay: 1000,
          maxRetries: 5,
          strategy: 'exponential_backoff_with_jitter',
        };

      case 'BOT_DETECTION_ERROR':
        if (
          error instanceof BotDetectionError &&
          error.detectionType === 'captcha'
        ) {
          return {
            shouldRetry: true,
            delay: 30000, // 30秒待機
            maxRetries: 2,
            strategy: 'fixed_delay_with_strategy_change',
          };
        }
        return {
          shouldRetry: false,
          delay: 0,
          maxRetries: 0,
          strategy: 'no_retry',
        };

      case 'RESOURCE_LIMIT_ERROR':
        return {
          shouldRetry: true,
          delay: 5000,
          maxRetries: 3,
          strategy: 'linear_backoff',
        };

      case 'BROWSER_ERROR':
        return {
          shouldRetry: true,
          delay: 3000,
          maxRetries: 2,
          strategy: 'fixed_delay',
        };

      default:
        return {
          shouldRetry: true,
          delay: 1000,
          maxRetries: 3,
          strategy: 'exponential_backoff',
        };
    }
  }
}
