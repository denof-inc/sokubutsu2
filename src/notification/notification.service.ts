import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private bot: Telegraf;
  private chatId: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!token || !this.chatId) {
      this.logger.error('TelegramのトークンまたはチャットIDが設定されていません。');
      return;
    }
    this.bot = new Telegraf(token);
  }

  async sendNotification(message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(this.chatId, message);
      this.logger.log(`通知を送信しました: ${message}`);
    } catch (error) {
      this.logger.error('Telegram通知の送信に失敗しました。', error);
    }
  }
}
