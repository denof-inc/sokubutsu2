import { Injectable, Logger } from '@nestjs/common';
import { MetricsCollectorService } from './metrics-collector.service';
import { AlertManagerService } from './alert-manager.service';
import {
  SystemMetrics,
  BotProtectionMetrics,
  ResponseTimeMetrics,
  ProcessMetrics,
} from './monitoring.types';

@Injectable()
export class ComprehensiveMonitorService {
  private readonly logger = new Logger(ComprehensiveMonitorService.name);
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly metricsCollector: MetricsCollectorService,
    private readonly alertManager: AlertManagerService,
  ) {}

  async startMonitoring(): Promise<void> {
    // システムリソース監視（30秒間隔）
    this.startResourceMonitoring();

    // Bot対策成功率監視（5分間隔）
    this.startBotProtectionMonitoring();

    // 応答時間監視（1分間隔）
    this.startResponseTimeMonitoring();

    // プロセス監視（1分間隔）
    this.startProcessMonitoring();

    this.logger.log('包括的監視システム開始');
  }

  async stopMonitoring(): Promise<void> {
    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      this.logger.log(`監視停止: ${name}`);
    }

    this.monitoringIntervals.clear();
  }

  private startResourceMonitoring(): void {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const metrics = await this.metricsCollector.collectSystemMetrics();
          await this.evaluateSystemMetrics(metrics);
        } catch (error) {
          this.logger.error(
            `システムメトリクス収集失敗: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 30000);

    this.monitoringIntervals.set('resource', interval);
  }

  private startBotProtectionMonitoring(): void {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const metrics =
            await this.metricsCollector.collectBotProtectionMetrics();
          await this.evaluateBotProtectionMetrics(metrics);
        } catch (error) {
          this.logger.error(
            `Bot対策メトリクス収集失敗: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 300000);

    this.monitoringIntervals.set('bot-protection', interval);
  }

  private startResponseTimeMonitoring(): void {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const metrics =
            await this.metricsCollector.collectResponseTimeMetrics();
          await this.evaluateResponseTimeMetrics(metrics);
        } catch (error) {
          this.logger.error(
            `応答時間メトリクス収集失敗: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 60000);

    this.monitoringIntervals.set('response-time', interval);
  }

  private startProcessMonitoring(): void {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const metrics = await this.metricsCollector.collectProcessMetrics();
          await this.evaluateProcessMetrics(metrics);
        } catch (error) {
          this.logger.error(
            `プロセスメトリクス収集失敗: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 60000);

    this.monitoringIntervals.set('process', interval);
  }

  private async evaluateSystemMetrics(metrics: SystemMetrics): Promise<void> {
    // メモリ使用量の評価
    if (metrics.memory.usagePercent > 85) {
      await this.alertManager.sendAlert({
        level: 'CRITICAL',
        type: 'MEMORY_USAGE',
        message: `メモリ使用量が危険レベル: ${metrics.memory.usagePercent.toFixed(2)}%`,
        metrics,
        recommendedAction: '即座にメモリクリーンアップを実行してください',
      });
    } else if (metrics.memory.usagePercent > 70) {
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'MEMORY_USAGE',
        message: `メモリ使用量が高レベル: ${metrics.memory.usagePercent.toFixed(2)}%`,
        metrics,
        recommendedAction: 'メモリ使用量の監視を強化してください',
      });
    }

    // CPU使用率の評価
    if (metrics.cpu.usagePercent > 80) {
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'CPU_USAGE',
        message: `CPU使用率が高レベル: ${metrics.cpu.usagePercent.toFixed(2)}%`,
        metrics,
        recommendedAction: 'CPU集約的な処理の調整を検討してください',
      });
    }

    // ディスク使用量の評価
    if (metrics.disk && metrics.disk.usagePercent > 90) {
      await this.alertManager.sendAlert({
        level: 'CRITICAL',
        type: 'DISK_USAGE',
        message: `ディスク使用量が危険レベル: ${metrics.disk.usagePercent.toFixed(2)}%`,
        metrics,
        recommendedAction: '不要なファイルの削除を実行してください',
      });
    }
  }

  private async evaluateBotProtectionMetrics(
    metrics: BotProtectionMetrics,
  ): Promise<void> {
    // 成功率の評価
    if (metrics.overallSuccessRate < 50) {
      await this.alertManager.sendAlert({
        level: 'CRITICAL',
        type: 'BOT_PROTECTION_FAILURE',
        message: `Bot対策成功率が低下: ${metrics.overallSuccessRate.toFixed(2)}%`,
        metrics,
        recommendedAction: 'Bot対策戦略の見直しが必要です',
      });
    } else if (metrics.overallSuccessRate < 70) {
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'BOT_PROTECTION_DEGRADATION',
        message: `Bot対策成功率が低下傾向: ${metrics.overallSuccessRate.toFixed(2)}%`,
        metrics,
        recommendedAction: 'Bot対策手法の調整を検討してください',
      });
    }

    // サイト別成功率の評価
    for (const [site, successRate] of Object.entries(
      metrics.siteSuccessRates,
    )) {
      if (successRate < 30) {
        await this.alertManager.sendAlert({
          level: 'WARNING',
          type: 'SITE_SPECIFIC_FAILURE',
          message: `${site}での成功率が低下: ${successRate.toFixed(2)}%`,
          metrics: { site, successRate },
          recommendedAction: `${site}専用の対策を検討してください`,
        });
      }
    }
  }

  private async evaluateResponseTimeMetrics(
    metrics: ResponseTimeMetrics,
  ): Promise<void> {
    // 平均応答時間の評価
    if (metrics.averageResponseTime > 30000) {
      // 30秒
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'SLOW_RESPONSE',
        message: `平均応答時間が遅延: ${(metrics.averageResponseTime / 1000).toFixed(2)}秒`,
        metrics,
        recommendedAction: 'ネットワーク状況とサイト応答性を確認してください',
      });
    }

    // タイムアウト率の評価
    if (metrics.timeoutRate > 20) {
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'HIGH_TIMEOUT_RATE',
        message: `タイムアウト率が高い: ${metrics.timeoutRate.toFixed(2)}%`,
        metrics,
        recommendedAction: 'タイムアウト設定の調整を検討してください',
      });
    }
  }

  private async evaluateProcessMetrics(metrics: ProcessMetrics): Promise<void> {
    // プロセス数の評価
    if (metrics.activeBrowserProcesses > 5) {
      await this.alertManager.sendAlert({
        level: 'WARNING',
        type: 'TOO_MANY_PROCESSES',
        message: `アクティブなブラウザプロセス数が多い: ${String(metrics.activeBrowserProcesses)}個`,
        metrics,
        recommendedAction: '不要なプロセスの終了を検討してください',
      });
    }

    // プロセス生存時間の評価
    const longRunningProcesses = metrics.processLifetimes.filter(
      (lifetime) => lifetime > 600000,
    ); // 10分
    if (longRunningProcesses.length > 0) {
      await this.alertManager.sendAlert({
        level: 'INFO',
        type: 'LONG_RUNNING_PROCESSES',
        message: `長時間実行中のプロセス: ${String(longRunningProcesses.length)}個`,
        metrics: { longRunningProcesses },
        recommendedAction: 'プロセスの定期的な再起動を検討してください',
      });
    }
  }

  onModuleDestroy(): void {
    void this.stopMonitoring();
  }
}
