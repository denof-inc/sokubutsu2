import { Injectable, Logger } from '@nestjs/common';
import { BrowserPoolManager } from '../browser-pool/browser-pool-manager';
import { IntelligentCacheService } from '../cache/intelligent-cache.service';
import { ScrapingResult } from '../strategies/google-access.strategy';

interface ScrapingTask {
  id: string;
  url: string;
  selector: string;
  priority: number;
  retryCount?: number;
  timeout?: number;
}

interface BatchResult {
  successful: ScrapingResult[];
  failed: Array<{
    task: ScrapingTask;
    error: string;
  }>;
  totalTime: number;
  averageTime: number;
}

@Injectable()
export class ParallelScrapingOrchestrator {
  private readonly logger = new Logger(ParallelScrapingOrchestrator.name);
  private readonly maxConcurrency = 5; // 同時実行数
  private readonly taskQueue: ScrapingTask[] = [];
  private activeTasks = 0;

  constructor(
    private readonly browserPool: BrowserPoolManager,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * 複数のスクレイピングタスクを並列実行
   */
  async executeBatch(tasks: ScrapingTask[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: ScrapingResult[] = [];
    const failures: Array<{ task: ScrapingTask; error: string }> = [];

    // タスクを優先度順にソート
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    // キャッシュチェック
    const uncachedTasks: ScrapingTask[] = [];
    for (const task of sortedTasks) {
      const cached = await this.cacheService.get(task.url);
      if (cached) {
        this.logger.debug(`Cache hit for ${task.url}`);
        results.push({
          ...cached,
          method: 'cache',
          executionTime: 0,
        });
      } else {
        uncachedTasks.push(task);
      }
    }

    // 並列実行
    await this.executeParallel(uncachedTasks, results, failures);

    const totalTime = Date.now() - startTime;
    const averageTime = results.length > 0 ? totalTime / results.length : 0;

    this.logger.log(
      `Batch execution completed: ${results.length} successful, ${failures.length} failed`,
    );
    this.logger.log(
      `Total time: ${totalTime}ms, Average: ${averageTime.toFixed(2)}ms`,
    );

    return {
      successful: results,
      failed: failures,
      totalTime,
      averageTime,
    };
  }

  /**
   * 並列実行ロジック
   */
  private async executeParallel(
    tasks: ScrapingTask[],
    results: ScrapingResult[],
    failures: Array<{ task: ScrapingTask; error: string }>,
  ): Promise<void> {
    this.taskQueue.push(...tasks);

    const promises: Promise<void>[] = [];

    // 最大同時実行数まで並列でタスクを開始
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks < this.maxConcurrency
    ) {
      const task = this.taskQueue.shift()!;
      promises.push(this.executeTask(task, results, failures));
    }

    // すべてのタスクが完了するまで待機
    await Promise.all(promises);

    // 残りのタスクがあれば再帰的に実行
    if (this.taskQueue.length > 0) {
      await this.executeParallel([], results, failures);
    }
  }

  /**
   * 個別タスクの実行
   */
  private async executeTask(
    task: ScrapingTask,
    results: ScrapingResult[],
    failures: Array<{ task: ScrapingTask; error: string }>,
  ): Promise<void> {
    this.activeTasks++;
    const timeout = task.timeout || 30000;

    try {
      // ブラウザインスタンスを取得
      const browser = await this.browserPool.acquire();

      try {
        // タイムアウト制御付きでスクレイピング実行
        const result = await this.executeWithTimeout(async () => {
          const page = await browser.newPage();

          try {
            // 実際のスクレイピング処理（戦略に応じて選択）
            const scrapingResult = await this.performScraping(page, task);

            // 成功したらキャッシュに保存
            if (scrapingResult.success) {
              await this.cacheService.set(task.url, scrapingResult);
            }

            return scrapingResult;
          } finally {
            await page.close();
          }
        }, timeout);

        results.push(result);
        this.logger.debug(`Task ${task.id} completed successfully`);
      } finally {
        // ブラウザインスタンスを返却
        await this.browserPool.release(browser);
      }
    } catch (error) {
      this.logger.error(`Task ${task.id} failed: ${error.message}`);
      failures.push({
        task,
        error: error.message,
      });

      // リトライロジック
      if ((task.retryCount || 0) < 2) {
        this.logger.debug(`Retrying task ${task.id}`);
        this.taskQueue.push({
          ...task,
          retryCount: (task.retryCount || 0) + 1,
        });
      }
    } finally {
      this.activeTasks--;

      // 待機中のタスクがあれば次を開始
      if (this.taskQueue.length > 0 && this.activeTasks < this.maxConcurrency) {
        const nextTask = this.taskQueue.shift()!;
        this.executeTask(nextTask, results, failures);
      }
    }
  }

  /**
   * タイムアウト制御付き実行
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout),
      ),
    ]);
  }

  /**
   * 実際のスクレイピング処理（簡略版）
   */
  private async performScraping(
    page: any,
    task: ScrapingTask,
  ): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      await page.goto(task.url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // セレクタが指定されていれば要素を待機
      if (task.selector) {
        await page.waitForSelector(task.selector, { timeout: 10000 });
      }

      const content = await page.content();

      return {
        success: true,
        content,
        method: 'parallel-scraping',
        executionTime: Date.now() - startTime,
        metadata: {
          taskId: task.id,
          url: task.url,
        },
      };
    } catch (error) {
      return {
        success: false,
        method: 'parallel-scraping',
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * 実行統計の取得
   */
  getExecutionStats(): {
    activeTasks: number;
    queuedTasks: number;
    poolStatus: any;
  } {
    return {
      activeTasks: this.activeTasks,
      queuedTasks: this.taskQueue.length,
      poolStatus: this.browserPool.getStatus(),
    };
  }
}
