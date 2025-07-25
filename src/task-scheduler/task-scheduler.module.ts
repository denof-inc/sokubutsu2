import { Module } from '@nestjs/common';
import { TaskSchedulerService } from './task-scheduler.service';
import { UrlModule } from '../url/url.module';

@Module({
  imports: [UrlModule],
  providers: [TaskSchedulerService],
})
export class TaskSchedulerModule {}
