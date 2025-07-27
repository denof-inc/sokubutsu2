declare module 'vibelogger' {
  export interface LogOptions {
    context?: Record<string, any>;
    humanNote?: string;
    aiTodo?: string;
  }

  export interface VibeLogger {
    info(operation: string, message: string, options?: LogOptions): void;
    error(operation: string, message: string, options?: LogOptions): void;
    warn(operation: string, message: string, options?: LogOptions): void;
    debug(operation: string, message: string, options?: LogOptions): void;
  }

  export function createFileLogger(projectName: string): VibeLogger;
  export function createLogger(projectName: string): VibeLogger;
  export function createEnvLogger(projectName: string): VibeLogger;
}