import axios from 'axios';
import { NotificationData, Statistics, UrlStatistics } from './types.js';
import { vibeLogger } from './logger.js';

/**
 * シンプルなTelegram通知サービス（axios版）
 */
export class TelegramNotifierSimple {
  private readonly apiUrl: string;
  private readonly chatId: string;
  private readonly maxRetries = 3;

  constructor(botToken: string, chatId: string) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.chatId = chatId;
  }

  /**
   * Telegram接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SokubutsuBot/1.0)',
        },
      });
      
      if (response.data.ok) {
        vibeLogger.info('telegram.connection_success', 'Telegram Bot接続成功', {
          context: { 
            username: response.data.result.username, 
            botId: response.data.result.id 
          },
        });
        return true;
      }
      return false;
    } catch (error) {
      vibeLogger.error('telegram.connection_failed', 'Telegram Bot接続失敗', {
        context: {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          } : { message: String(error) },
        },
        aiTodo: 'Telegram BotトークンとChat IDの設定を確認',
      });
      return false;
    }
  }

  /**
   * メッセージ送信
   */
  async sendMessage(message: string, retryCount = 0): Promise<void> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; SokubutsuBot/1.0)',
          },
        }
      );

      if (response.data.ok) {
        vibeLogger.info('telegram.message_sent', 'Telegram通知送信成功', {
          context: { chatId: this.chatId },
        });
      }
    } catch (error) {
      vibeLogger.error('telegram.message_failed', `Telegram通知送信失敗`, {
        context: {
          chatId: this.chatId,
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          } : { message: String(error) },
        },
        humanNote: 'リトライ処理を実行中',
      });

      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 指数バックオフ
        await this.sleep(delay);
        return this.sendMessage(message, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * 起動通知
   */
  async sendStartupNotice(): Promise<void> {
    const message = `
🚀 *ソクブツ監視サービス起動*

システムが正常に起動しました。
新着物件の監視を開始します。

⏰ 監視間隔: 5分
📊 統計レポート: 1時間ごと
    `;
    await this.sendMessage(message);
  }

  /**
   * 停止通知
   */
  async sendShutdownNotice(): Promise<void> {
    const message = `
🛑 *ソクブツ監視サービス停止*

システムを停止しました。
監視を再開するには、サービスを再起動してください。
    `;
    await this.sendMessage(message);
  }

  /**
   * エラーアラート送信
   */
  async sendErrorAlert(url: string, errorMessage: string): Promise<void> {
    // URLから地域情報を抽出
    const match = url.match(/\/(chintai|buy_other)\/([^/]+)\//); 
    const area = match ? match[2] : 'unknown';
    
    const message = `
⚠️ *エラーアラート*

📍 *エリア*: ${area}
❌ *エラー*: ${errorMessage}
⏰ *発生時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
🔗 *URL*: ${url}

3回連続でエラーが発生しています。設定を確認してください。
    `;
    await this.sendMessage(message);
  }

  /**
   * 統計レポート通知
   */
  async sendStatisticsReport(stats: Statistics): Promise<void> {
    const uptimeHours = Math.floor((Date.now() - stats.lastCheck.getTime()) / (1000 * 60 * 60));

    const message = `
📊 *ソクブツ統計レポート*

📈 *パフォーマンス*
  • 総チェック数: ${stats.totalChecks}回
  • 成功率: ${stats.successRate}%
  • 平均実行時間: ${stats.averageExecutionTime.toFixed(2)}秒

🏠 *検知実績*
  • 新着検知数: ${stats.newListings}回
  • エラー数: ${stats.errors}回

⏰ *稼働状況*
  • 最終チェック: ${stats.lastCheck.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
  • 稼働時間: 約${uptimeHours}時間

${stats.successRate >= 95 ? '✅ *システムは正常に動作しています*' : '⚠️ *エラー率が高めです。設定をご確認ください*'}
    `;
    await this.sendMessage(message);
  }

  /**
   * URL別サマリーレポート送信
   */
  async sendUrlSummaryReport(stats: UrlStatistics): Promise<void> {
    try {
      // URLから都道府県名を抽出
      const match = stats.url.match(/\/(chintai|buy_other)\/([^/]+)\//);
      const prefecture = match ? match[2] : 'unknown';
      
      const now = new Date();
      const currentTime = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      
      let message = `📊 *1時間サマリー*\n\n`;
      message += `📍 *エリア*: ${prefecture}\n`;
      message += `⏰ *時刻*: ${currentTime}\n`;
      message += `🔢 *チェック回数*: ${stats.totalChecks}回\n`;
      message += `✅ *成功率*: ${stats.successRate.toFixed(1)}%\n`;
      
      if (stats.hasNewProperty) {
        message += `🆕 *新着*: ${stats.newPropertyCount}件\n`;
      } else {
        message += `📝 *新着*: なし\n`;
      }
      
      message += `\n🔗 ${stats.url}`;
      
      await this.sendMessage(message);
    } catch (error) {
      vibeLogger.error('telegram.url_report_failed', 'URL別レポート送信失敗', {
        context: {
          url: stats.url,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * URLを表示用にフォーマット
   */
  private formatUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url.length > 50 ? `${url.substring(0, 47)}...` : url;
    }
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}