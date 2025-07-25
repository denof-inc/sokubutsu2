// src/task-scheduler/task-scheduler.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { UrlService } from '../url/url.service';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(private readonly urlService: UrlService) {}

  onModuleInit() {
    this.scheduleJobs();
  }

  private scheduleJobs() {
    cron.schedule('* * * * *', async () => {
      this.logger.log('cronジョブを開始します...');
      
      const urlsToScrape = await this.urlService.findAllActive();
      this.logger.log(`${urlsToScrape.length}件のURLを監視します。`);

      for (const url of urlsToScrape) {
        this.logger.log(`[${url.name}] の監視を実行中...`);
        // TODO: ここでPlaywrightを使ったスクレイピング処理を呼び出す
      }

      this.logger.log('今回のcronジョブは完了しました。');
    });

    this.logger.log('監視ジョブをスケジュールしました。');
  }
}