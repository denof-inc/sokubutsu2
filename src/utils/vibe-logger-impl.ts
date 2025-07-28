/**
 * vibelogger互換の実装
 * vibeloggerのESモジュール問題を回避するための独自実装
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LogOptions {
  context?: Record<string, unknown>;
  humanNote?: string;
  aiTodo?: string;
  correlationId?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  event: string;
  message: string;
  context?: Record<string, unknown>;
  humanNote?: string;
  aiTodo?: string;
  correlationId?: string;
}

export class VibeLogger {
  private readonly projectName: string;
  private readonly logDir: string;
  private readonly logFile: string;

  constructor(projectName: string) {
    this.projectName = projectName;
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `${projectName}.log.jsonl`);

    // ログディレクトリの作成
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeLog(level: string, event: string, message: string, options?: LogOptions): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      ...options,
    };

    // ファイルに書き込み（JSONL形式）
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Failed to write log:', error);
    }

    // コンソールにも出力（開発環境）
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      const consoleMessage = `[${level}] [${event}] ${message}`;
      const consoleData = options?.context ? options.context : {};

      switch (level) {
        case 'ERROR':
          console.error(consoleMessage, consoleData);
          break;
        case 'WARN':
          console.warn(consoleMessage, consoleData);
          break;
        case 'INFO':
          console.info(consoleMessage, consoleData);
          break;
        case 'DEBUG':
          if (process.env.LOG_LEVEL === 'debug') {
            console.debug(consoleMessage, consoleData);
          }
          break;
      }
    }
  }

  error(event: string, message: string, options?: LogOptions): void {
    this.writeLog('ERROR', event, message, options);
  }

  warn(event: string, message: string, options?: LogOptions): void {
    this.writeLog('WARN', event, message, options);
  }

  info(event: string, message: string, options?: LogOptions): void {
    this.writeLog('INFO', event, message, options);
  }

  debug(event: string, message: string, options?: LogOptions): void {
    this.writeLog('DEBUG', event, message, options);
  }
}

export function createFileLogger(projectName: string): VibeLogger {
  return new VibeLogger(projectName);
}
