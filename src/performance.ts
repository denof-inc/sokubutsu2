import { PerformanceMetrics } from './types.js';
import { vibeLogger } from './logger.js';

/**
 * パフォーマンス監視クラス
 *
 * @設計ドキュメント
 * - README.md: パフォーマンス目標値
 * - docs/パフォーマンス戦略.md: 測定指標と最適化方針
 *
 * @関連クラス
 * - Logger: パフォーマンス測定結果のログ出力
 * - main.ts: 起動時のパフォーマンス表示
 * - types.ts: PerformanceMetrics型定義
 *
 * @主要機能
 * - 起動時間測定（目標: 1-2秒）
 * - メモリ使用量監視（目標: 30-50MB）
 * - CPU使用率測定
 * - 実行時間測定デコレータ
 * - 戦略目標との自動比較・検証
 */
export class PerformanceMonitor {
  private readonly startTime: number;
  private readonly initialMemory: number;

  constructor() {
    this.startTime = Date.now();
    this.initialMemory = process.memoryUsage().heapUsed;
  }

  /**
   * 起動時間を測定
   */
  getStartupTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 現在のメモリ使用量を取得（MB）
   */
  getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  }

  /**
   * CPU使用率を取得（概算）
   */
  getCpuUsage(): number {
    const usage = process.cpuUsage();
    const total = usage.user + usage.system;
    return Math.round((total / 1000000) * 100) / 100; // マイクロ秒を秒に変換
  }

  /**
   * 実行時間を測定する関数デコレータ
   */
  static measureExecutionTime<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      try {
        const result = await fn(...args);
        const executionTime = Date.now() - startTime;
        vibeLogger.debug('performance.execution_time', `実行時間: ${executionTime}ms`, {
          context: { functionName: fn.name, executionTime },
        });
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        vibeLogger.error('performance.execution_error', `実行エラー`, {
          context: {
            functionName: fn.name,
            executionTime,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : { message: String(error) },
          },
          aiTodo: '実行エラーのパターンを分析',
        });
        throw error;
      }
    };
  }

  /**
   * パフォーマンス指標を取得
   */
  getMetrics(): PerformanceMetrics {
    return {
      startupTime: this.getStartupTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      executionTime: 0, // 実行時に設定
      cpuUsage: this.getCpuUsage(),
    };
  }

  /**
   * パフォーマンス指標を表示
   */
  displayMetrics(): void {
    const metrics = this.getMetrics();

    console.log('📊 パフォーマンス指標:');
    console.log(`  - 起動時間: ${metrics.startupTime}ms`);
    console.log(`  - メモリ使用量: ${metrics.memoryUsage}MB`);
    console.log(`  - CPU使用率: ${metrics.cpuUsage}%`);

    // 戦略目標との比較
    this.validatePerformance(metrics);
  }

  /**
   * パフォーマンス目標との比較
   */
  private validatePerformance(metrics: PerformanceMetrics): void {
    const issues: string[] = [];

    // 起動時間チェック（目標: 1-2秒）
    if (metrics.startupTime > 2000) {
      issues.push(`起動時間が目標を超過: ${metrics.startupTime}ms > 2000ms`);
    }

    // メモリ使用量チェック（目標: 30-50MB）
    if (metrics.memoryUsage > 50) {
      issues.push(`メモリ使用量が目標を超過: ${metrics.memoryUsage}MB > 50MB`);
    } else if (metrics.memoryUsage < 30) {
      vibeLogger.info('performance.memory_below_target', 'メモリ使用量が目標を下回る（良好）', {
        context: { memoryUsage: metrics.memoryUsage, target: 30 },
        humanNote: 'メモリ使用量が非常に効率的です',
      });
    }

    if (issues.length > 0) {
      vibeLogger.warn('performance.targets_not_met', '⚠️  パフォーマンス目標未達成', {
        context: { issues, metrics },
        aiTodo: 'パフォーマンス問題の解決策を提案',
      });
    } else {
      vibeLogger.info('performance.targets_met', '✅ パフォーマンス目標達成', {
        context: { metrics },
        humanNote: 'システムのパフォーマンスが良好です',
      });
    }
  }
}

// グローバルインスタンス
export const performanceMonitor = new PerformanceMonitor();
