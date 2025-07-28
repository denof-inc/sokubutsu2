/**
 * Cronジョブ管理クラス
 *
 * @設計ドキュメント
 * - docs/スケジューリング設計.md: cron式と実行タイミング
 *
 * @関連クラス
 * - MonitoringScheduler: このクラスを使用してジョブを管理
 * - vibeLogger: ジョブの実行状況をログ出力
 */

import * as cron from 'node-cron';
import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';
import { IJobManager } from './interfaces';

export class JobManager implements IJobManager {
  private readonly jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * ジョブをスケジュール
   */
  schedule(cronExpression: string, name: string, handler: () => void | Promise<void>): void {
    if (this.jobs.has(name)) {
      vibeLogger.warn('job.already_exists', `ジョブ ${name} は既に存在します`, {
        context: { jobName: name },
      });
      return;
    }

    const job = cron.schedule(
      cronExpression,
      () => {
        void (async () => {
          vibeLogger.debug('job.executing', `ジョブ実行開始: ${name}`, {
            context: { jobName: name, cronExpression },
          });

          try {
            const startTime = Date.now();
            await handler();
            const executionTime = Date.now() - startTime;

            vibeLogger.info('job.completed', `ジョブ実行完了: ${name}`, {
              context: { jobName: name, executionTime },
            });
          } catch (error) {
            vibeLogger.error('job.error', `ジョブ実行エラー: ${name}`, {
              context: {
                jobName: name,
                error: formatError(error),
              },
              aiTodo: 'ジョブのエラーパターンを分析',
            });
          }
        })();
      },
      {
        scheduled: false, // 手動で開始
      }
    );

    this.jobs.set(name, job);
    vibeLogger.info('job.scheduled', `ジョブをスケジュール: ${name}`, {
      context: { jobName: name, cronExpression },
    });
  }

  /**
   * すべてのジョブを開始
   */
  startAll(): void {
    for (const [name, job] of this.jobs) {
      job.start();
      vibeLogger.info('job.started', `ジョブを開始: ${name}`, {
        context: { jobName: name },
      });
    }
  }

  /**
   * すべてのジョブを停止
   */
  stopAll(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      vibeLogger.info('job.stopped', `ジョブを停止: ${name}`, {
        context: { jobName: name },
      });
    }
    this.jobs.clear();
  }

  /**
   * ジョブの状態を取得
   */
  getStatus(): { [jobName: string]: boolean } {
    const status: { [jobName: string]: boolean } = {};
    for (const [name, job] of this.jobs) {
      // node-cronのScheduledTaskには直接的なrunning状態がないため、
      // ジョブが存在するかどうかで判断
      status[name] = job !== null && job !== undefined;
    }
    return status;
  }

  /**
   * 特定のジョブを削除
   */
  remove(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      vibeLogger.info('job.removed', `ジョブを削除: ${name}`, {
        context: { jobName: name },
      });
    }
  }
}
