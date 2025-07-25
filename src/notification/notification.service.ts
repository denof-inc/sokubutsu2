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
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    // ★★★ ここからが修正点 ★★★
    // 環境変数が設定されているか、厳密にチェックする
    if (!token || !chatId) {
      const errorMessage =
        'TelegramのトークンまたはチャットIDが.envファイルに設定されていません。';
      this.logger.error(errorMessage);
      // エラーを投げて、アプリケーションの起動を安全に中止する
      throw new Error(errorMessage);
    }
    // ★★★ ここまでが修正点 ★★★

    this.bot = new Telegraf(token);
    this.chatId = chatId; // チェック済みなので、安全に代入できる
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
