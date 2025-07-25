// src/task-scheduler/task-scheduler.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);

  // onModuleInitは、このモジュールが初期化された時に一度だけ呼ばれるメソッドです。
  onModuleInit() {
    this.scheduleTestJob();
  }

  private scheduleTestJob() {
    // 毎分実行するテスト用のcronジョブ
    // cron式の意味: (秒 分 時 日 月 曜日)
    // '* * * * *' は「毎分」を意味します。
    cron.schedule('* * * * *', () => {
      this.logger.log('cronジョブを実行中... 将来ここでスクレイピングが動きます。');
    });

    this.logger.log('テスト用のcronジョブをスケジュールしました。1分ごとにログが出力されます。');
  }
}