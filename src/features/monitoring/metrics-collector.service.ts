import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import { ProcessManagerService } from './process-manager.service';
import {
  SystemMetrics,
  BotProtectionMetrics,
  ResponseTimeMetrics,
  ProcessMetrics,
} from './monitoring.types';

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);
  private scrapingAttempts: Map<string, { success: number; failure: number }> =
    new Map();
  private responseTimes: number[] = [];
  private timeouts: number = 0;

  constructor(private readonly processManager: ProcessManagerService) {}

  async collectSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const totalMemory = 7.7 * 1024 * 1024 * 1024; // 7.7GB

    // CPU使用率の計算
    const cpuPercent = await this.calculateCpuUsage();

    return {
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        usagePercent: (memoryUsage.rss / totalMemory) * 100,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usagePercent: cpuPercent,
      },
      disk: await this.getDiskUsage(),
      timestamp: new Date(),
    };
  }

  async collectBotProtectionMetrics(): Promise<BotProtectionMetrics> {
    const siteSuccessRates: { [key: string]: number } = {};
    let totalSuccess = 0;
    let totalAttempts = 0;

    for (const [site, stats] of this.scrapingAttempts) {
      const total = stats.success + stats.failure;
      if (total > 0) {
        siteSuccessRates[site] = (stats.success / total) * 100;
        totalSuccess += stats.success;
        totalAttempts += total;
      }
    }

    return {
      overallSuccessRate:
        totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0,
      siteSuccessRates,
      totalAttempts,
      successfulAttempts: totalSuccess,
      failedAttempts: totalAttempts - totalSuccess,
      timestamp: new Date(),
    };
  }

  async collectResponseTimeMetrics(): Promise<ResponseTimeMetrics> {
    const validResponseTimes = this.responseTimes.filter((t) => t > 0);
    const totalRequests = this.responseTimes.length;

    return {
      averageResponseTime:
        validResponseTimes.length > 0
          ? validResponseTimes.reduce((a, b) => a + b, 0) /
            validResponseTimes.length
          : 0,
      minResponseTime:
        validResponseTimes.length > 0 ? Math.min(...validResponseTimes) : 0,
      maxResponseTime:
        validResponseTimes.length > 0 ? Math.max(...validResponseTimes) : 0,
      timeoutRate:
        totalRequests > 0 ? (this.timeouts / totalRequests) * 100 : 0,
      totalRequests,
      timestamp: new Date(),
    };
  }

  async collectProcessMetrics(): Promise<ProcessMetrics> {
    const activeProcesses = this.processManager.getActiveProcessCount();
    const processInfo = this.processManager.getProcessInfo();

    const now = Date.now();
    const processLifetimes = processInfo.map(
      (info) => now - info.createdAt.getTime(),
    );

    return {
      activeBrowserProcesses: activeProcesses,
      totalProcessesCreated: processInfo.length,
      processLifetimes,
      averageLifetime:
        processLifetimes.length > 0
          ? processLifetimes.reduce((a, b) => a + b, 0) /
            processLifetimes.length
          : 0,
      timestamp: new Date(),
    };
  }

  // メトリクス記録メソッド
  recordScrapingAttempt(site: string, success: boolean): void {
    const stats = this.scrapingAttempts.get(site) || { success: 0, failure: 0 };
    if (success) {
      stats.success++;
    } else {
      stats.failure++;
    }
    this.scrapingAttempts.set(site, stats);
  }

  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    // 最新の1000件のみ保持
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  recordTimeout(): void {
    this.timeouts++;
  }

  private async calculateCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return usage;
  }

  private async getDiskUsage(): Promise<
    { usagePercent: number; free: number; total: number } | undefined
  > {
    // ディスク使用量の取得（簡易版）
    // 実際の実装では、osディスク使用量を取得するライブラリを使用
    try {
      // TODO: 実際のディスク使用量を取得
      return {
        usagePercent: 50, // 仮の値
        free: 100 * 1024 * 1024 * 1024, // 100GB
        total: 200 * 1024 * 1024 * 1024, // 200GB
      };
    } catch (error) {
      this.logger.error(
        `ディスク使用量取得失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
