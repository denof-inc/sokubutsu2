/**
 * リトライ処理ユーティリティ
 *
 * @設計ドキュメント
 * - docs/システム設計書.md: エラーハンドリング方針
 * - docs/スクレイピング戦略.md: リトライ戦略
 *
 * @関連クラス
 * - SimpleScraper: スクレイピング処理のリトライ
 * - TelegramNotifier: 通知送信のリトライ
 * - vibeLogger: リトライ状況のログ出力
 */

import { vibeLogger } from './logger';
import { formatError } from './error-handler';

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * リトライ処理を実行
 * @param fn 実行する関数
 * @param options リトライオプション
 * @returns 実行結果
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, retryDelay, backoffMultiplier = 1, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt);

        vibeLogger.warn('retry.attempt', `リトライ実行: ${attempt + 1}/${maxRetries}`, {
          context: {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: formatError(error),
          },
          humanNote: 'エラー発生によりリトライを実行します',
        });

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await sleep(delay);
      }
    }
  }

  vibeLogger.error('retry.max_attempts_exceeded', 'リトライ回数上限に到達', {
    context: {
      maxRetries,
      lastError: formatError(lastError),
    },
    aiTodo: 'リトライ戦略の見直しを検討',
  });

  throw lastError;
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
