import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

/**
 * ログレベル
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * ログ管理クラス
 * 
 * @設計ドキュメント
 * - README.md: ログ出力設定
 * - docs/ログ設計.md: ログレベルとファイル出力
 * 
 * @関連クラス
 * - config: ログディレクトリとログレベル設定の取得
 * - 全クラス: このLoggerクラスを使用してログ出力
 * 
 * @主要機能
 * - 4段階のログレベル管理（ERROR/WARN/INFO/DEBUG）
 * - 日付別ログファイル自動生成
 * - コンソールとファイルへの同時出力
 * - JSON形式でのデータ構造化ログ
 */
export class Logger {
  private readonly logLevel: LogLevel;
  private readonly logDir: string;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = path.join(config.storage.dataDir, '../logs');
    this.ensureLogDirectory();
  }

  /**
   * ログレベルを環境変数から取得
   */
  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  /**
   * ログディレクトリの存在確認・作成
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * ログメッセージをフォーマット
   */
  private formatMessage(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
    }
    
    return baseMessage;
  }

  /**
   * ログをファイルに書き込み
   */
  private writeToFile(level: string, message: string): void {
    const filename = `sokubutsu-${new Date().toISOString().split('T')[0]}.log`;
    const filepath = path.join(this.logDir, filename);
    
    try {
      fs.appendFileSync(filepath, message + '\n');
    } catch (error) {
      console.error('ログファイル書き込みエラー:', error);
    }
  }

  /**
   * エラーログ
   */
  error(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.ERROR) {
      const formatted = this.formatMessage('ERROR', message, data);
      console.error(formatted);
      this.writeToFile('ERROR', formatted);
    }
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.WARN) {
      const formatted = this.formatMessage('WARN', message, data);
      console.warn(formatted);
      this.writeToFile('WARN', formatted);
    }
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.INFO) {
      const formatted = this.formatMessage('INFO', message, data);
      console.log(formatted);
      this.writeToFile('INFO', formatted);
    }
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message, data);
      console.log(formatted);
      this.writeToFile('DEBUG', formatted);
    }
  }
}

// シングルトンインスタンス
export const logger = new Logger();