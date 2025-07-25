import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TaskSchedulerModule } from './task-scheduler/task-scheduler.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UrlModule } from './url/url.module';
import { ScrapingModule } from './scraping/scraping.module';
import { NotificationModule } from './notification/notification.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DATABASE_TYPE');

        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: configService.get<string>('DATABASE_HOST'),
            port: configService.get<number>('DATABASE_PORT'),
            username: configService.get<string>('DATABASE_USERNAME'),
            password: configService.get<string>('DATABASE_PASSWORD'),
            database: configService.get<string>('DATABASE_NAME'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // 開発中はtrue、本番ではfalseにしてマイグレーションを使う
          };
        }

        // デフォルトは better-sqlite3
        return {
          type: 'better-sqlite3',
          database: configService.get<string>('DATABASE_PATH', 'sokubutsu.sqlite'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
        };
      },
    }),
    TaskSchedulerModule,
    UrlModule,
    ScrapingModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
