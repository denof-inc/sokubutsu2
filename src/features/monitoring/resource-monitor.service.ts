import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

interface SystemMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    usagePercent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  timestamp: Date;
}

@Injectable()
export class ResourceMonitorService {
  private readonly logger = new Logger(ResourceMonitorService.name);
  private monitoringInterval: NodeJS.Timeout;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      void (async () => {
        const metrics = await this.collectMetrics();
        await this.evaluateMetrics(metrics);
      })();
    }, 30000); // 30秒間隔で監視
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        usagePercent: (memoryUsage.rss / (7.7 * 1024 * 1024 * 1024)) * 100, // 7.7GB総メモリ
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      timestamp: new Date(),
    };
  }

  private async evaluateMetrics(metrics: SystemMetrics): Promise<void> {
    // メモリ使用量の警告
    if (metrics.memory.usagePercent > 80) {
      this.logger.error(
        `メモリ使用量が危険レベル: ${metrics.memory.usagePercent.toFixed(2)}%`,
      );
      await this.triggerEmergencyCleanup();
    } else if (metrics.memory.usagePercent > 60) {
      this.logger.warn(
        `メモリ使用量が高レベル: ${metrics.memory.usagePercent.toFixed(2)}%`,
      );
    }

    // ヒープメモリの監視
    if (metrics.memory.heapUsed > 500 * 1024 * 1024) {
      // 500MB
      this.logger.warn(
        `ヒープメモリ使用量が高レベル: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      );
    }
  }

  private async triggerEmergencyCleanup(): Promise<void> {
    this.logger.error('緊急メモリクリーンアップを実行');

    // ガベージコレクションの強制実行
    if (global.gc) {
      global.gc();
    }

    // Playwrightプロセスの強制終了
    // この部分は ProcessManagerService と連携
  }

  onModuleDestroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}
