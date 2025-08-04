import * as cron from 'node-cron';
import { UserService } from '../services/UserService.js';
import { NotificationService } from '../services/NotificationService.js';
import { SimpleScraper } from '../scraper.js';
import { PropertyMonitor } from '../property-monitor.js';
import { UserUrl } from '../entities/UserUrl.js';
import { config } from '../config.js';
import { vibeLogger } from '../logger.js';
import { AppDataSource } from '../database/connection.js';

export class MultiUserMonitoringScheduler {
  private readonly userService: UserService;
  private readonly notificationService: NotificationService;
  private readonly scraper: SimpleScraper;
  private readonly propertyMonitor: PropertyMonitor;
  private cronJob?: cron.ScheduledTask;
  private statsJob?: cron.ScheduledTask;

  constructor() {
    this.userService = new UserService();
    this.notificationService = new NotificationService(config.telegram.botToken);
    this.scraper = new SimpleScraper();
    this.propertyMonitor = new PropertyMonitor();
  }

  /**
   * 監視スケジューラー開始
   */
  async start(): Promise<void> {
    console.log('📊 マルチユーザー監視スケジューラー起動中...');

    // 初回実行
    await this.runMonitoringCycle();

    // 定期実行設定（5分ごと）
    this.cronJob = cron.schedule(config.monitoring.interval ?? '*/5 * * * *', () => {
      void this.runMonitoringCycle();
    });

    // 統計レポート（1時間ごと）
    this.statsJob = cron.schedule('0 * * * *', () => {
      void this.sendAllUserStatistics();
    });

    this.cronJob.start();
    this.statsJob.start();

    vibeLogger.info('scheduler.started', 'マルチユーザー監視スケジューラー起動完了', {
      context: {
        interval: config.monitoring.interval,
        statsInterval: '0 * * * *',
      },
      humanNote: '全ユーザーのURL監視を開始しました',
    });
  }

  /**
   * 監視サイクル実行
   */
  private async runMonitoringCycle(): Promise<void> {
    const cycleId = `cycle-${Date.now()}`;

    vibeLogger.info('monitoring.cycle.start', '監視サイクル開始', {
      context: { cycleId, timestamp: new Date().toLocaleString('ja-JP') },
    });

    try {
      // 全ユーザーの監視対象URLを取得
      const urls = await this.userService.getAllActiveMonitoringUrls();

      vibeLogger.info('monitoring.urls.fetched', '監視対象URL取得', {
        context: { totalUrls: urls.length, cycleId },
      });

      // 各URLを並列で監視
      const monitoringPromises = urls.map(url => this.monitorUrl(url));
      await Promise.allSettled(monitoringPromises);

      vibeLogger.info('monitoring.cycle.complete', '監視サイクル完了', {
        context: {
          cycleId,
          urlsMonitored: urls.length,
          timestamp: new Date().toLocaleString('ja-JP'),
        },
      });
    } catch (error) {
      vibeLogger.error('monitoring.cycle.error', '監視サイクルエラー', {
        context: { cycleId, error },
        humanNote: '監視サイクル中にエラーが発生しました',
      });
    }
  }

  /**
   * 個別URL監視
   */
  private async monitorUrl(userUrl: UserUrl): Promise<void> {
    const startTime = Date.now();

    try {
      // スクレイピング実行
      const scrapingResult = await this.scraper.scrapeAthome(userUrl.url);

      // 監視統計更新
      const urlRepository = AppDataSource.getRepository(UserUrl);
      userUrl.totalChecks++;
      userUrl.lastCheckedAt = new Date();

      if (!scrapingResult.success) {
        userUrl.errorCount++;
        await urlRepository.save(userUrl);

        vibeLogger.warn('monitoring.url.error', 'URL監視エラー', {
          context: {
            urlId: userUrl.id,
            url: userUrl.url,
            error: scrapingResult.error,
          },
        });
        return;
      }

      // 新着物件検知
      const detectionResult = this.propertyMonitor.detectNewProperties(
        scrapingResult.properties ?? []
      );

      // ハッシュ更新
      if (userUrl.lastHash !== scrapingResult.hash) {
        userUrl.lastHash = scrapingResult.hash;
      }

      // 新着があれば通知
      if (detectionResult.hasNewProperty && userUrl.lastHash) {
        userUrl.newListingsCount++;
        await this.notificationService.sendNewPropertyNotification(userUrl, detectionResult);

        vibeLogger.info('monitoring.new_property.detected', '新着物件検知', {
          context: {
            urlId: userUrl.id,
            userId: userUrl.userId,
            newCount: detectionResult.newPropertyCount,
            url: userUrl.url,
          },
          humanNote: `${userUrl.name}で新着物件を検知しました`,
        });
      }

      await urlRepository.save(userUrl);

      const executionTime = Date.now() - startTime;
      vibeLogger.debug('monitoring.url.complete', 'URL監視完了', {
        context: {
          urlId: userUrl.id,
          executionTime,
          hasNewProperty: detectionResult.hasNewProperty,
        },
      });
    } catch (error) {
      vibeLogger.error('monitoring.url.fatal_error', 'URL監視致命的エラー', {
        context: {
          urlId: userUrl.id,
          url: userUrl.url,
          error,
        },
      });
    }
  }

  /**
   * 全ユーザー統計レポート送信
   */
  private async sendAllUserStatistics(): Promise<void> {
    try {
      const users = await this.userService.getAllUsers();

      for (const user of users) {
        if (user.isActive && user.urls.length > 0) {
          await this.notificationService.sendUserStatisticsReport(user.id);
        }
      }

      vibeLogger.info('statistics.sent_all', '全ユーザー統計送信完了', {
        context: { userCount: users.length },
        humanNote: '定期統計レポートを全ユーザーに送信しました',
      });
    } catch (error) {
      vibeLogger.error('statistics.send_error', '統計送信エラー', {
        context: { error },
      });
    }
  }

  /**
   * スケジューラー停止
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    if (this.statsJob) {
      this.statsJob.stop();
    }

    vibeLogger.info('scheduler.stopped', 'マルチユーザー監視スケジューラー停止', {
      humanNote: '全ユーザーの監視を停止しました',
    });
  }
}
