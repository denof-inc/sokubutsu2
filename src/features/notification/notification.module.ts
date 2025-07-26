import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    {
      provide: NotificationService,
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
        const chatId = configService.get<string>('TELEGRAM_CHAT_ID');

        // テスト環境や環境変数がない場合はモックを返す
        if (!token || !chatId || token === 'dummy_token') {
          return {
            sendNotification: async (message: string) => {
              console.log('[Mock Notification]:', message);
            },
          };
        }

        return new NotificationService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
