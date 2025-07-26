// src/task-scheduler/task-scheduler.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { UrlService } from '../url/url.service';
import { ScrapingService } from '../scraping/scraping.service';
import { NotificationService } from '../notification/notification.service';
import { Url } from '../url/url.entity';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly urlService: UrlService,
    private readonly scrapingService: ScrapingService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.scheduleJobs();
  }

  private scheduleJobs() {
    cron.schedule('* * * * *', async () => {
      this.logger.log('====== cronジョブを開始します ======');
      const urlsToScrape = await this.urlService.findAllActive();
      this.logger.log(`${urlsToScrape.length}件のURLを監視します。`);

      for (const url of urlsToScrape) {
        await this.processUrl(url);
      }
      this.logger.log('====== 今回のcronジョブは完了しました ======');
    });

    this.logger.log('監視ジョブをスケジュールしました。');
  }

  private async processUrl(url: Url) {
    this.logger.log(`[${url.name}] の監視を実行中...`);
    const newHash = await this.scrapingService.scrapeAndGetHash(url.url, url.selector);

    if (!newHash) {
      this.logger.warn(`[${url.name}] のハッシュ値を取得できませんでした。`);
      return;
    }

    const oldHash = url.contentHash;
    this.logger.log(`[${url.name}] 古いハッシュ: ${oldHash?.substring(0, 10)}...`);
    this.logger.log(`[${url.name}] 新しいハッシュ: ${newHash.substring(0, 10)}...`);

    if (oldHash !== newHash) {
      this.logger.log(`★★★★★ [${url.name}] 変更を検知しました！ ★★★★★`);
      await this.notificationService.sendNotification(
        `【ソクブツ速報】\n物件に新着の可能性があります！\n\n物件名: ${url.name}\nURL: ${url.url}`
      );
      await this.urlService.updateHash(url.id, newHash);
      this.logger.log(`[${url.name}] のハッシュ値を更新しました。`);
    } else {
      this.logger.log(`[${url.name}] 変更はありませんでした。`);
    }
  }
}