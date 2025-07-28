import { createFileLogger, LogOptions } from 'vibelogger';

/**
 * ログ管理モジュール（vibelogger統合版）
 *
 * @設計ドキュメント
 * - README.md: ログ出力設定
 * - docs/ログ設計.md: ログレベルとファイル出力
 * - CLAUDE.md: vibelogger利用ガイドライン
 *
 * @関連クラス
 * - 全クラス: このloggerインスタンスを使用してログ出力
 * - vibelogger: AI最適化された構造化ログライブラリ
 *
 * @主要機能
 * - AI駆動開発に最適化された構造化ログ
 * - 自動的なタイムスタンプとコンテキスト記録
 * - humanNoteとaiTodoによる注釈機能
 * - 相関IDによるトレース機能
 */

// 後方互換性のためのログレベル定義
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * vibeloggerインスタンス
 * プロジェクト名を使って自動的にログファイルが作成される
 */
const vibeLogger = createFileLogger('sokubutsu');

/**
 * 後方互換性のためのLoggerクラス
 * 既存のコードとの互換性を保ちながらvibeloggerの機能を提供
 */
export class Logger {
  /**
   * エラーログ
   */
  error(message: string, data?: unknown): void {
    const options: LogOptions = {
      humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
    };
    if (data) {
      options.context = { data };
    }
    vibeLogger.error('legacy.error', message, options);
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: unknown): void {
    const options: LogOptions = {
      humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
    };
    if (data) {
      options.context = { data };
    }
    vibeLogger.warn('legacy.warn', message, options);
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: unknown): void {
    const options: LogOptions = {
      humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
    };
    if (data) {
      options.context = { data };
    }
    vibeLogger.info('legacy.info', message, options);
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: unknown): void {
    const options: LogOptions = {
      humanNote: 'レガシーAPIからの移行。詳細なコンテキストを追加することを推奨',
    };
    if (data) {
      options.context = { data };
    }
    vibeLogger.debug('legacy.debug', message, options);
  }
}

// シングルトンインスタンス（後方互換性）
export const logger = new Logger();

// vibeloggerの新しいAPIも公開
export { vibeLogger };

/**
 * 新しいvibelogger APIの使用例
 *
 * @example
 * ```typescript
 * import { vibeLogger } from './logger';
 *
 * // 構造化されたログ出力
 * vibeLogger.info('user.login', 'ユーザーログイン処理', {
 *   context: {
 *     userId: '123',
 *     method: 'oauth',
 *     timestamp: new Date().toISOString(),
 *   },
 *   humanNote: '不審なログインパターンを監視',
 *   aiTodo: 'ログイン時間の異常を検知して通知',
 * });
 * ```
 */
