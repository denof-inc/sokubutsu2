import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Telegramメッセージ送信
   */
  async sendMessage(
    chatId: number,
    text: string,
    options?: {
      parse_mode?: 'Markdown' | 'HTML';
      disable_web_page_preview?: boolean;
      disable_notification?: boolean;
      reply_markup?: any;
    }
  ): Promise<void> {
    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        ...options,
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      this.logger.debug(`Message sent to ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * 写真付きメッセージ送信（物件情報通知用）
   */
  async sendPhoto(
    chatId: number,
    photo: string,
    caption?: string,
    options?: {
      parse_mode?: 'Markdown' | 'HTML';
      disable_notification?: boolean;
    }
  ): Promise<void> {
    try {
      const response = await axios.post(`${this.apiUrl}/sendPhoto`, {
        chat_id: chatId,
        photo,
        caption,
        ...options,
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      this.logger.debug(`Photo sent to ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send photo to ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * インラインキーボード付きメッセージ送信
   */
  async sendMessageWithKeyboard(
    chatId: number,
    text: string,
    keyboard: any[][]
  ): Promise<void> {
    await this.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }

  /**
   * Webhook設定
   */
  async setWebhook(webhookUrl: string): Promise<void> {
    try {
      const response = await axios.post(`${this.apiUrl}/setWebhook`, {
        url: webhookUrl,
      });

      if (!response.data.ok) {
        throw new Error(`Failed to set webhook: ${response.data.description}`);
      }

      this.logger.log(`Webhook set to ${webhookUrl}`);
    } catch (error) {
      this.logger.error('Failed to set webhook:', error);
      throw error;
    }
  }

  /**
   * Webhook削除
   */
  async deleteWebhook(): Promise<void> {
    try {
      const response = await axios.post(`${this.apiUrl}/deleteWebhook`);

      if (!response.data.ok) {
        throw new Error(`Failed to delete webhook: ${response.data.description}`);
      }

      this.logger.log('Webhook deleted');
    } catch (error) {
      this.logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Bot情報取得
   */
  async getMe(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);

      if (!response.data.ok) {
        throw new Error(`Failed to get bot info: ${response.data.description}`);
      }

      return response.data.result;
    } catch (error) {
      this.logger.error('Failed to get bot info:', error);
      throw error;
    }
  }
}