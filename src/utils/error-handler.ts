/**
 * エラーハンドリングユーティリティ
 *
 * @設計ドキュメント
 * - docs/システム設計書.md: エラーハンドリング方針
 *
 * @関連クラス
 * - Logger: エラーログの出力先
 * - TelegramNotifier: エラー通知の送信
 * - SimpleScraper: スクレイピングエラーの処理
 * - MonitoringScheduler: 監視エラーの処理
 * - SimpleStorage: ストレージエラーの処理
 */

/**
 * エラーオブジェクトを標準形式にフォーマット
 */
export function formatError(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.stack && { stack: error.stack }),
      ...(error.name && { name: error.name }),
    };
  }
  return { message: String(error) };
}

/**
 * エラーメッセージを取得
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * エラーの詳細情報を取得
 */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  const formatted = formatError(error);
  return {
    error: formatted,
    timestamp: new Date().toISOString(),
    type: error?.constructor?.name || 'Unknown',
  };
}
