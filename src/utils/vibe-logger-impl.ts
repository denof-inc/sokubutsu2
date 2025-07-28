import * as fs from 'fs';
import * as path from 'path';

export interface LogOptions {
  context?: Record<string, unknown>;
  humanNote?: string;
  aiTodo?: string;
}

export class VibeLogger {
  private readonly projectName: string;
  private readonly logDir: string;
  private readonly logFile: string;

  constructor(projectName: string) {
    this.projectName = projectName;
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `${projectName}.jsonl`);

    // ログディレクトリを作成
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeLog(level: string, event: string, message: string, options?: LogOptions): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      projectName: this.projectName,
      ...options,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error(`Failed to write log: ${String(error)}`);
    }

    // コンソールにも出力（開発時の利便性のため）
    const consoleMessage = `[${level.toUpperCase()}] ${event}: ${message}`;
    switch (level) {
      case 'error':
        console.error(consoleMessage, options);
        break;
      case 'warn':
        console.warn(consoleMessage, options);
        break;
      case 'info':
        console.info(consoleMessage, options);
        break;
      case 'debug':
        console.debug(consoleMessage, options);
        break;
    }
  }

  error(event: string, message: string, options?: LogOptions): void {
    this.writeLog('error', event, message, options);
  }

  warn(event: string, message: string, options?: LogOptions): void {
    this.writeLog('warn', event, message, options);
  }

  info(event: string, message: string, options?: LogOptions): void {
    this.writeLog('info', event, message, options);
  }

  debug(event: string, message: string, options?: LogOptions): void {
    this.writeLog('debug', event, message, options);
  }
}

export function createFileLogger(projectName: string): VibeLogger {
  return new VibeLogger(projectName);
}

export function createLogger(projectName: string): VibeLogger {
  return new VibeLogger(projectName);
}

export function createEnvLogger(projectName: string): VibeLogger {
  return new VibeLogger(projectName);
}
