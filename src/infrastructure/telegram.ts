import { Telegraf } from 'telegraf';
import { NotificationData, Statistics } from '../types';
import { vibeLogger } from '../utils/logger';
import { formatError } from '../utils/error-handler';
import { withRetry } from '../utils/retry';

/**
 * Telegram通知サービス
 *
 * @設計ドキュメント
 * - README.md: Telegram Bot設定ガイド
 * - docs/通知設計.md: 通知フォーマットとタイミング
 *
 * @関連クラス
 * - MonitoringScheduler: スケジューラーから通知メソッドを呼び出し
 * - Logger: 通知の送信結果をログ出力
 * - types.ts: NotificationData, Statistics型定義
 *
 * @主要機能
 * - 新着物件の即時通知
 * - エラーアラート送信
 * - 統計レポート定期送信
 * - リトライ機能付きメッセージ送信
 */
export class TelegramNotifier {
  private readonly bot: Telegraf;
  private readonly chatId: string;
  private readonly maxRetries = 3;

  constructor(botToken: string, chatId: string) {
    this.bot = new Telegraf(botToken);
    this.chatId = chatId;
  }

  /**
   * Telegram接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const me = await this.bot.telegram.getMe();
      vibeLogger.info('telegram.connection_success', 'Telegram Bot接続成功', {
        context: { username: me.username, botId: me.id },
      });
      return true;
    } catch (error) {
      vibeLogger.error('telegram.connection_failed', 'Telegram Bot接続失敗', {
        context: {
          error: formatError(error),
        },
        aiTodo: 'Telegram BotトークンとChat IDの設定を確認',
      });
      return false;
    }
  }

  /**
   * 起動通知
   */
  async sendStartupNotice(): Promise<void> {
    const message = `
🚀 *ソクブツMVP起動完了*

📅 *起動時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
⚙️ *監視間隔*: 5分
🎯 *戦略*: HTTP-first + 軽量実装

✅ システムが正常に起動し、物件監視を開始しました。
新着物件が検知されると即座に通知いたします！

🏠 *理想の物件との出会いをお手伝いします*
    `;

    await this.sendMessage(message);
  }

  /**
   * 新着物件通知
   */
  async sendNewListingNotification(data: NotificationData): Promise<void> {
    const changeCount = data.currentCount - data.previousCount;
    const changeIcon = changeCount > 0 ? '📈' : '📉';
    const changeText = changeCount > 0 ? `+${changeCount}件増加` : `${Math.abs(changeCount)}件減少`;

    const message = `
🏠 *新着物件検知！*

${changeIcon} *変化*: ${changeText}
📊 *現在の物件数*: ${data.currentCount}件
📋 *前回の物件数*: ${data.previousCount}件
⏰ *検知時刻*: ${data.detectedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
⚡ *処理時間*: ${data.executionTime?.toFixed(1) ?? 'N/A'}秒

🔗 *物件を確認*: [こちらをクリック](${data.url})

${changeCount > 0 ? '🎉 *新しい物件が追加されました！今すぐチェックして理想の物件をゲットしましょう！*' : '📝 *物件情報が更新されました。最新の情報をご確認ください。*'}
    `;

    await this.sendMessage(message);
  }

  /**
   * エラー通知
   */
  async sendErrorAlert(url: string, error: string): Promise<void> {
    const message = `
❌ *監視エラー発生*

🌐 *URL*: ${this.formatUrl(url)}
🚨 *エラー内容*: \`${error}\`
⏰ *発生時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

🔧 *自動復旧を試行中...*
継続的にエラーが発生する場合は、設定をご確認ください。
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
   * システム停止通知
   */
  async sendShutdownNotice(): Promise<void> {
    const message = `
🛑 *ソクブツMVP停止*

⏰ *停止時刻*: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

システムが正常に停止されました。
再起動時に改めて通知いたします。

🙏 *ご利用ありがとうございました*
    `;

    await this.sendMessage(message);
  }

  /**
   * メッセージ送信（リトライ機能付き）
   */
  private async sendMessage(message: string): Promise<void> {
    await withRetry(
      async () => {
        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
          link_preview_options: {
            is_disabled: true,
          },
        });

        vibeLogger.debug('telegram.message_sent', 'Telegram通知送信成功', {
          context: { chatId: this.chatId },
        });
      },
      {
        maxRetries: this.maxRetries,
        retryDelay: 1000,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          vibeLogger.error('telegram.message_failed', `Telegram通知送信失敗`, {
            context: {
              chatId: this.chatId,
              retryCount: attempt,
              maxRetries: this.maxRetries,
              error: formatError(error),
            },
            humanNote: 'リトライ処理を実行中',
          });
        },
      }
    );
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
   * Bot情報を取得
   */
  async getBotInfo(): Promise<{ username: string; id: number }> {
    const me = await this.bot.telegram.getMe();
    return {
      username: me.username || 'unknown',
      id: me.id,
    };
  }
}
