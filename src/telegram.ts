import { Telegraf } from 'telegraf';

export class TelegramNotifier {
  private bot: Telegraf;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new Telegraf(token);
    this.chatId = chatId;
  }

  async sendNewListingAlert(url: string, count: number): Promise<void> {
    const message = `🏠 新着物件検知！

URL: ${url}
物件数: ${count}件
時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

すぐに確認してください！`;
    
    try {
      await this.bot.telegram.sendMessage(this.chatId, message, {
        disable_web_page_preview: true,
        parse_mode: 'HTML'
      });
      console.log(`[${new Date().toISOString()}] Telegram通知送信完了`);
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Telegram通知エラー:`, error.message);
      throw error;
    }
  }

  async sendSystemAlert(message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        this.chatId, 
        `🤖 システム通知\n\n${message}\n\n時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
      );
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] システム通知エラー:`, error.message);
    }
  }

  async sendStartupNotice(): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        this.chatId,
        `✅ ソクブツ監視開始\n\n監視システムが正常に起動しました。\n5分間隔で物件をチェックします。\n\n時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
      );
    } catch (error: any) {
      console.error('起動通知エラー:', error.message);
    }
  }

  async sendErrorAlert(url: string, error: string): Promise<void> {
    const message = `⚠️ 監視エラー

URL: ${url}
エラー: ${error}
時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

監視は継続されます。`;

    try {
      await this.bot.telegram.sendMessage(this.chatId, message);
    } catch (err: any) {
      console.error('エラー通知送信失敗:', err.message);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const me = await this.bot.telegram.getMe();
      console.log(`Telegram Bot接続成功: @${me.username}`);
      return true;
    } catch (error: any) {
      console.error('Telegram Bot接続エラー:', error.message);
      return false;
    }
  }
}