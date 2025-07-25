import { Module } from '@nestjs/common';
import { TaskSchedulerService } from './task-scheduler.service';
import { UrlModule } from '../url/url.module';
import { ScrapingModule } from '../scraping/scraping.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [UrlModule, ScrapingModule, NotificationModule],
  providers: [TaskSchedulerService],
})
export class TaskSchedulerModule {}
