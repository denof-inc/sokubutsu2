import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TaskSchedulerModule } from './features/task-scheduler/task-scheduler.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UrlModule } from './domain/url/url.module';
import { ScrapingModule } from './features/scraping/scraping.module';
import { NotificationModule } from './features/notification/notification.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { BotProtectionModule } from './features/bot-protection/bot-protection.module';
import { MonitoringModule } from './features/monitoring/monitoring.module';
import { DataAcquisitionModule } from './features/data-acquisition/data-acquisition.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './domain/users/users.module';
import { TelegramModule } from './domain/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    BotProtectionModule,
    MonitoringModule,
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
          database: configService.get<string>(
            'DATABASE_PATH',
            'sokubutsu.sqlite',
          ),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
        };
      },
    }),
    // Core modules
    AuthModule,
    UsersModule,
    TelegramModule,
    // Feature modules
    TaskSchedulerModule,
    UrlModule,
    ScrapingModule,
    NotificationModule,
    DataAcquisitionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
