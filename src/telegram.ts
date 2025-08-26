import { Telegraf } from 'telegraf';
import { NotificationData, Statistics, UrlStatistics } from './types.js';
import { vibeLogger } from './logger.js';

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
   * MarkdownV2用エスケープ処理
   */
  private escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  /**
   * 管理画面リンク作成
   */
  private createAdminLink(name: string): string {
    const escapedName = this.escapeMarkdownV2(name);
    return `[${escapedName}](http://localhost:3005)`;
  }

  /**
   * 起動完了通知
   */
  async sendStartupNotice(): Promise<void> {
    const message = `🚀 ソクブツMVP起動完了

📅 起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
⚙️ 監視間隔: 5分
🎯 戦略: HTTP\\-first \\+ 軽量実装

✅ システムが正常に起動し、物件監視を開始しました。
新着物件が検知されると即座に通知いたします！

🏠 理想の物件との出会いをお手伝いします`;

    await this.sendMessage(message);
  }

  /**
   * 新着物件通知
   */
  async sendNewListingNotification(data: NotificationData): Promise<void> {
    const changeCount = data.currentCount - data.previousCount;
    const changeIcon = changeCount > 0 ? '🆕' : '📉';
    const changeText = changeCount > 0 ? `+${changeCount}件` : `${Math.abs(changeCount)}件減少`;

    // URLから地域情報を抽出
    const match = data.url.match(/\/(chintai|buy_other)\/([^/]+)\//); 
    const area = match?.[2] ?? 'unknown';
    
    const message = `🆕 新着物件あり

📍 エリア: ${this.escapeMarkdownV2(area)}
⏰ 検知時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

    await this.sendMessage(message);
  }

  /**
   * エラー通知
   */
  async sendErrorAlert(url: string, error: string): Promise<void> {
    // URLから地域情報を抽出
    const match = url.match(/\/(chintai|buy_other)\/([^/]+)\//); 
    const area = match?.[2] ?? 'unknown';
    
    // 一般ユーザー向けのエラーメッセージに変換
    let userFriendlyError = 'サイトへの接続に問題が発生しています';
    if (error.includes('timeout') || error.includes('Timeout')) {
      userFriendlyError = 'サイトの応答が遅くなっています';
    } else if (error.includes('認証') || error.includes('auth')) {
      userFriendlyError = 'サイトが一時的にアクセス制限をしています';
    } else if (error.includes('network') || error.includes('Network')) {
      userFriendlyError = 'ネットワーク接続に問題があります';
    }
    
    const message = `⚠️ 監視エラーのお知らせ

📍 監視名: ${this.escapeMarkdownV2(area)}エリア物件
⏰ 時間: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
🔢 エラー数: 3回連続（15分間）
❌ エラー内容: ${this.escapeMarkdownV2(userFriendlyError)}

しばらく時間をおいて自動的に再試行します。
継続的にエラーが発生する場合は、サポートまでご連絡ください。`;

    await this.sendMessage(message);
  }

  /**
   * 統計レポート通知
   */
  async sendStatisticsReport(stats: Statistics): Promise<void> {
    const uptimeHours = Math.floor((Date.now() - stats.lastCheck.getTime()) / (1000 * 60 * 60));

    const message = `📊 ソクブツ統計レポート

📈 パフォーマンス
  • 総チェック数: ${stats.totalChecks}回
  • 成功率: ${stats.successRate}%
  • 平均実行時間: ${stats.averageExecutionTime.toFixed(2)}秒

🏠 検知実績
  • 新着検知数: ${stats.newListings}回
  • エラー数: ${stats.errors}回

⏰ 稼働状況
  • 最終チェック: ${stats.lastCheck.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
  • 稼働時間: 約${uptimeHours}時間

${stats.successRate >= 95 ? '✅ システムは正常に動作しています' : '⚠️ エラー率が高めです。設定をご確認ください'}`;

    await this.sendMessage(message);
  }

  /**
   * URL別サマリーレポート送信
   */
  async sendUrlSummaryReport(stats: UrlStatistics): Promise<void> {
    try {
      // URLから都道府県名を抽出
      const match = stats.url.match(/\/(chintai|buy_other)\/([^/]+)\//);
      const prefecture = match?.[2] ?? 'unknown';
      
      const now = new Date();
      const currentTime = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      
      let message = `📊 1時間サマリー

📍 エリア: ${this.escapeMarkdownV2(prefecture)}
⏰ 時刻: ${this.escapeMarkdownV2(currentTime)}

`;
      
      // 5分ごとの履歴を表示
      if (stats.hourlyHistory && stats.hourlyHistory.length > 0) {
        message += `📝 5分ごとの結果:
`;
        for (const entry of stats.hourlyHistory) {
          let icon = '✅';
          if (entry.status === 'あり') {
            icon = '🆕';
          } else if (entry.status === 'エラー') {
            icon = '❌';
          }
          message += `• ${this.escapeMarkdownV2(entry.time)} ${icon} ${this.escapeMarkdownV2(entry.status)}
`;
        }
        message += `
`;
      }
      
      message += `📊 統計:
• チェック回数: ${stats.totalChecks}回
• 成功率: ${stats.successRate.toFixed(1)}%
`;
      
      if (stats.hasNewProperty) {
        message += `• 新着総数: ${stats.newPropertyCount}件
`;
      }
      
      message += `
🔗 ${this.createAdminLink(stats.name)}`;
      
      await this.sendMessage(message);
      
      vibeLogger.info('telegram.url_summary_report_sent', 'URL別サマリーレポート送信成功', {
        context: { url: stats.url, prefecture },
      });
    } catch (error) {
      vibeLogger.error('telegram.url_summary_report_error', 'URL別サマリーレポート送信失敗', {
        context: {
          url: stats.url,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      // エラーをthrowせずに監視を継続
    }
  }

  /**
   * システム停止通知
   */
  async sendShutdownNotice(): Promise<void> {
    const message = `🛑 ソクブツMVP停止

⏰ 停止時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

システムが正常に停止されました。
再起動時に改めて通知いたします。

🙏 ご利用ありがとうございました`;

    await this.sendMessage(message);
  }

  /**
   * メッセージ送信（リトライ機能付き）
   */
  async sendMessage(message: string, retryCount = 0): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: {
          is_disabled: true,
        },
      });

      vibeLogger.debug('telegram.message_sent', 'Telegram通知送信成功', {
        context: { chatId: this.chatId },
      });
    } catch (error) {
      vibeLogger.error('telegram.message_failed', `Telegram通知送信失敗`, {
        context: {
          chatId: this.chatId,
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
        },
        humanNote: 'リトライ処理を実行中',
      });

      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 指数バックオフ
        await this.sleep(delay);
        return this.sendMessage(message, retryCount + 1);
      }

      // リトライ上限に達してもエラーをthrowしない（監視を止めないため）
      vibeLogger.error('telegram.message_failed_final', 'Telegram通知送信が最終的に失敗', {
        context: {
          chatId: this.chatId,
          totalRetries: retryCount,
          finalError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * 指定時間待機
   */
  /**
   * Bot接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.bot.telegram.getMe();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Bot情報取得
   */
  async getBotInfo(): Promise<{ id: number; username: string; firstName: string }> {
    try {
      const me = await this.bot.telegram.getMe();
      return {
        id: me.id,
        username: me.username || 'unknown',
        firstName: me.first_name,
      };
    } catch (error) {
      vibeLogger.error('telegram.get_bot_info_error', 'Bot情報取得失敗', {
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * コマンドハンドラーの設定
   */
  setupCommandHandlers(scheduler: any, userService?: any): void {
    // /status - 現在の監視状況
    this.bot.command('status', async (ctx) => {
      try {
        const status = await scheduler.getStatus();
        let message = `📊 *監視状況*

⏱ *稼働状態*: ${status.isRunning ? '✅ 稼働中' : '⏸ 停止中'}
📍 *監視URL数*: ${status.urlCount}件
⏰ *最終チェック*: ${status.lastCheck ? new Date(status.lastCheck).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'なし'}
🔄 *総チェック数*: ${status.totalChecks}回
✅ *成功率*: ${status.successRate.toFixed(1)}%`;
        
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        await ctx.reply('❌ ステータス取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.status_error', 'statusコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /stats - 統計情報表示
    this.bot.command('stats', async (ctx) => {
      try {
        const stats = await scheduler.getStatistics();
        let message = `📈 *統計情報*

📊 *パフォーマンス*
  • 総チェック数: ${stats.totalChecks}回
  • 成功率: ${stats.successRate}%
  • 平均実行時間: ${stats.averageExecutionTime.toFixed(2)}秒

🏠 *検知実績*
  • 新着検知数: ${stats.newListings}回
  • エラー数: ${stats.errors}回

⏰ *最終チェック*: ${stats.lastCheck.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;
        
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        await ctx.reply('❌ 統計情報取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.stats_error', 'statsコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /check - 手動チェック実行
    this.bot.command('check', async (ctx) => {
      try {
        await ctx.reply('🔍 手動チェックを開始します...');
        const result = await scheduler.runManualCheck();
        
        let message = `✅ *手動チェック完了*

📊 *結果*
  • チェックしたURL: ${result.urlCount}件
  • 成功: ${result.successCount}件
  • エラー: ${result.errorCount}件
  • 新着検知: ${result.newPropertyCount > 0 ? `🆕 ${result.newPropertyCount}件` : 'なし'}
  • 実行時間: ${(result.executionTime / 1000).toFixed(1)}秒`;
        
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        await ctx.reply('❌ 手動チェック中にエラーが発生しました');
        vibeLogger.error('telegram.command.check_error', 'checkコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /help - コマンド一覧
    this.bot.command('help', async (ctx) => {
      const message = `📚 *利用可能なコマンド*

/status \\- 現在の監視状況を表示
/stats \\- 詳細な統計情報を表示
/check \\- 手動でチェックを実行
/help \\- このヘルプメッセージを表示

🔔 *自動通知について*
• 新着物件検知時: 即座に通知
• 1時間ごと: サマリーレポート
• エラー時: 3回連続エラーで警告

📧 *サポート*
問題が発生した場合は管理者にお問い合わせください`;
      
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    });

    // /start - ウェルカムメッセージ
    this.bot.command('start', async (ctx) => {
      const message = `👋 *ソクブツMVPへようこそ！*

このBotは不動産サイトの新着物件を監視し、
リアルタイムで通知します。

利用可能なコマンドを見るには /help を入力してください。

監視は自動的に5分間隔で実行されています。`;
      
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    });
  }

  /**
   * Botを起動
   */
  async launchBot(): Promise<void> {
    try {
      await this.bot.launch();
      vibeLogger.info('telegram.bot_launched', 'Telegram Bot起動完了');
    } catch (error) {
      vibeLogger.error('telegram.bot_launch_error', 'Telegram Bot起動エラー', {
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Botを停止
   */
  stopBot(): void {
    this.bot.stop();
    vibeLogger.info('telegram.bot_stopped', 'Telegram Bot停止');
  }
}
