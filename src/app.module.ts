import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TaskSchedulerModule } from './task-scheduler/task-scheduler.module';
import { TypeOrmModule } from '@nestjs/typeorm'; // ★ インポート
import { UrlModule } from './url/url.module';

@Module({
  imports: [
    // ★ データベース接続設定を追加
    TypeOrmModule.forRoot({
      type: 'sqlite', // DBの種類
      database: 'sokubutsu.sqlite', // DBファイル名
      entities: [__dirname + '/**/*.entity{.ts,.js}'], // エンティティ（テーブル設計図）の場所
      synchronize: true, // trueにすると、エンティティの変更をDBに自動で反映してくれる（開発時に便利）
    }),
    TaskSchedulerModule,
    UrlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
