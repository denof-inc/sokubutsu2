import { Bot } from 'grammy';
import { NotificationData, Statistics, UrlStatistics } from './types.js';
import { vibeLogger } from './logger.js';
import { config } from './config.js';

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
interface IMonitoringScheduler {
  getStatus(): Promise<{
    isRunning: boolean;
    urlCount: number;
    lastCheck: Date | null;
    totalChecks: number;
    successRate: number;
  }>;
  getStatistics(): {
    totalChecks: number;
    errors: number;
    newListings: number;
    lastCheck: Date;
    averageExecutionTime: number;
    successRate: number;
  };
  runManualCheck(): Promise<{
    urlCount: number;
    successCount: number;
    errorCount: number;
    newPropertyCount: number;
    executionTime: number;
  }>;
}

export class TelegramNotifier {
  private readonly bot: Bot;
  private readonly chatId: string;
  private readonly maxRetries = 3;
  private running = false;

  constructor(botToken: string, chatId: string) {
    this.bot = new Bot(botToken);
    this.chatId = chatId;
  }

  /**
   * HTML用エスケープ処理
   */
  private escapeHtml(text: string): string {
    return text.replace(/[<>&]/g, match => {
      switch (match) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        default:
          return match;
      }
    });
  }

  /**
   * 管理画面リンク作成
   */
  private createAdminLink(name: string): string {
    const escapedName = this.escapeHtml(name);
    const publicUrl = config.admin?.publicUrl;
    if (publicUrl) {
      return `<a href="${this.escapeHtml(publicUrl)}">${escapedName}</a>`;
    }
    return `${escapedName}`;
  }

  /**
   * 起動完了通知
   */
  async sendStartupNotice(): Promise<void> {
    const message = `🚀 <b>ソクブツMVP起動完了</b>

📅 起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
⚙️ 監視間隔: 5分
🎯 戦略: HTTP-first + 軽量実装

✅ システムが正常に起動し、物件監視を開始しました。
新着物件が検知されると即座に通知いたします！

🏠 理想の物件との出会いをお手伝いします`;

    await this.sendMessage(message);
  }

  /**
   * 新着物件通知
   */
  async sendNewListingNotification(data: NotificationData, userName?: string): Promise<void> {
    // ユーザー定義名があればそれを使用、なければURLから地域情報を抽出
    let displayName: string;
    if (userName) {
      displayName = userName;
    } else {
      const match = data.url.match(/\/(chintai|buy_other)\/([^/]+)\//);
      displayName = match?.[2] ?? 'unknown';
    }

    const message = `🆕 <b>新着物件あり</b>

📍 監視名: ${this.createAdminLink(displayName)}
⏰ 検知時刻: ${this.escapeHtml(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}`;

    await this.sendMessage(message);
  }

  /**
   * エラー通知
   */
  async sendErrorAlert(url: string, error: string, userName?: string): Promise<void> {
    // ユーザー定義名があればそれを使用、なければURLから地域情報を抽出
    let displayName: string;
    if (userName) {
      displayName = userName;
    } else {
      const match = url.match(/\/(chintai|buy_other)\/([^/]+)\//);
      displayName = match?.[2] ?? 'unknown';
    }

    // 一般ユーザー向けのエラーメッセージに変換
    let userFriendlyError = 'サイトへの接続に問題が発生しています';
    if (error.includes('timeout') || error.includes('Timeout')) {
      userFriendlyError = 'サイトの応答が遅くなっています';
    } else if (error.includes('認証') || error.includes('auth')) {
      userFriendlyError = 'サイトが一時的にアクセス制限をしています';
    } else if (error.includes('network') || error.includes('Network')) {
      userFriendlyError = 'ネットワーク接続に問題があります';
    }

    const message = `⚠️ <b>監視エラーのお知らせ</b>

📍 監視名: ${this.createAdminLink(displayName)}
⏰ 時間: ${this.escapeHtml(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}
🔢 エラー数: 3回連続（15分間）
❌ エラー内容: ${this.escapeHtml(userFriendlyError)}

しばらく時間をおいて自動的に再試行します。
継続的にエラーが発生する場合は、サポートまでご連絡ください。`;

    await this.sendMessage(message);
  }

  /**
   * 統計レポート通知
   */
  async sendStatisticsReport(stats: Statistics): Promise<void> {
    const uptimeHours = Math.floor((Date.now() - stats.lastCheck.getTime()) / (1000 * 60 * 60));

    const message = `📊 <b>ソクブツ統計レポート</b>

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

      let message = `📊 <b>1時間サマリー</b>

📍 エリア: ${this.escapeHtml(prefecture)}
⏰ 時刻: ${this.escapeHtml(currentTime)}

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
          message += `• ${this.escapeHtml(entry.time)} ${icon} ${this.escapeHtml(entry.status)}
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
    const message = `🛑 <b>ソクブツMVP停止</b>

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
      await this.bot.api.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
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
      await this.bot.api.getMe();
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
      const me = await this.bot.api.getMe();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setupCommandHandlers(scheduler: IMonitoringScheduler): void {
    // Bot全体のエラーハンドリング（予期せぬ例外の可視化）
    this.bot.catch(err => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      vibeLogger.error('telegram.global_error', 'Telegramハンドラ内で未処理エラー', {
        context: {
          error: errorMsg,
        },
      });
    });

    // 受信メッセージの観測ログ（診断用）
    this.bot.on('message:text', async ctx => {
      try {
        const text = ctx.message?.text ?? '';
        const chat = ctx.chat?.type ?? 'unknown';
        vibeLogger.info('telegram.update_received', 'テキストメッセージ受信', {
          context: { text, chat, from: ctx.from?.id },
        });

        // コマンド文字列を抽出（/cmd または /cmd@botname 形式に対応）
        if (text.startsWith('/')) {
          const raw = (text.split(' ')[0] ?? '').trim();
          const name = raw.split('@')[0] ?? raw;
          switch (name) {
            case '/help': {
              const message = [
                '📚 利用可能なコマンド',
                '',
                '/status - 現在の監視状況を表示',
                '/stats  - 詳細な統計情報を表示',
                '/check  - 手動でチェックを実行',
                '/help   - このヘルプメッセージを表示',
              ].join('\n');
              await ctx.reply(message, { parse_mode: 'HTML' });
              vibeLogger.info('telegram.cmd_received', 'helpコマンドに応答しました');
              return;
            }
            case '/status': {
              try {
                const status = await scheduler.getStatus();
                const message = [
                  '📊 監視状況',
                  '',
                  `⏱ 稼働状態: ${status.isRunning ? '✅ 稼働中' : '⏸ 停止中'}`,
                  `📍 監視URL数: ${status.urlCount}件`,
                  `⏰ 最終チェック: ${status.lastCheck ? new Date(String(status.lastCheck)).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'なし'}`,
                  `📈 成功率: ${status.successRate}%`,
                  `🧪 総チェック数: ${status.totalChecks}`,
                ].join('\n');
                await ctx.reply(message, { parse_mode: 'HTML' });
                vibeLogger.info('telegram.cmd_received', 'statusコマンドに応答しました');
              } catch (error) {
                await ctx.reply('❌ ステータス取得に失敗しました');
                vibeLogger.error('telegram.command.status_error', 'statusコマンドエラー', {
                  context: { error: error instanceof Error ? error.message : String(error) },
                });
              }
              return;
            }
            case '/stats': {
              try {
                const stats = scheduler.getStatistics();
                const message = [
                  '📈 統計情報',
                  '',
                  `総チェック数: ${stats.totalChecks}`,
                  `エラー数: ${stats.errors}`,
                  `新着検知: ${stats.newListings}`,
                  `最終チェック: ${stats.lastCheck.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
                  `平均実行時間: ${stats.averageExecutionTime.toFixed(1)}秒`,
                  `成功率: ${stats.successRate}%`,
                ].join('\n');
                await ctx.reply(message, { parse_mode: 'HTML' });
                vibeLogger.info('telegram.cmd_received', 'statsコマンドに応答しました');
              } catch (error) {
                await ctx.reply('❌ 統計取得に失敗しました');
                vibeLogger.error('telegram.command.stats_error', 'statsコマンドエラー', {
                  context: { error: error instanceof Error ? error.message : String(error) },
                });
              }
              return;
            }
            case '/check': {
              await ctx.reply('🔍 手動チェックを開始します...');
              try {
                const result = await scheduler.runManualCheck();
                const message = [
                  '✅ 手動チェック完了',
                  '',
                  `  • チェックしたURL: ${result.urlCount}件`,
                  `  • 成功: ${result.successCount}件`,
                  `  • エラー: ${result.errorCount}件`,
                  `  • 新着検知: ${result.newPropertyCount > 0 ? `🆕 ${result.newPropertyCount}件` : 'なし'}`,
                  `  • 実行時間: ${(result.executionTime / 1000).toFixed(1)}秒`,
                ].join('\n');
                await ctx.reply(message, { parse_mode: 'HTML' });
                vibeLogger.info('telegram.cmd_received', 'checkコマンドに応答しました');
              } catch (error) {
                await ctx.reply('❌ 手動チェック中にエラーが発生しました');
                vibeLogger.error('telegram.command.check_error', 'checkコマンドエラー', {
                  context: { error: error instanceof Error ? error.message : String(error) },
                });
              }
              return;
            }
          }
        }
      } catch {
        // 受信観測のみ
      }
    });

    // /status - 現在の監視状況
    this.bot.command('status', async ctx => {
      try {
        const status = await scheduler.getStatus();
        // MarkdownV2はエスケープが厳しいため、まずはMarkdownで安定送信
        const message = [
          '📊 監視状況',
          '',
          `⏱ 稼働状態: ${status.isRunning ? '✅ 稼働中' : '⏸ 停止中'}`,
          `📍 監視URL数: ${status.urlCount}件`,
          `⏰ 最終チェック: ${status.lastCheck ? new Date(String(status.lastCheck)).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'なし'}`,
          `🔄 総チェック数: ${status.totalChecks}回`,
          `✅ 成功率: ${status.successRate.toFixed(1)}%`,
        ].join('\n');
        await ctx.reply(message, { parse_mode: 'HTML' });
      } catch (error) {
        await ctx.reply('❌ ステータス取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.status_error', 'statusコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /stats - 統計情報表示
    this.bot.command('stats', async ctx => {
      try {
        const stats = scheduler.getStatistics();
        const message = [
          '📈 統計情報',
          '',
          '📊 パフォーマンス',
          `  • 総チェック数: ${stats.totalChecks}回`,
          `  • 成功率: ${stats.successRate}%`,
          `  • 平均実行時間: ${stats.averageExecutionTime.toFixed(2)}秒`,
          '',
          '🏠 検知実績',
          `  • 新着検知数: ${stats.newListings}回`,
          `  • エラー数: ${stats.errors}回`,
          '',
          `⏰ 最終チェック: ${stats.lastCheck.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
        ].join('\n');
        await ctx.reply(message, { parse_mode: 'HTML' });
      } catch (error) {
        await ctx.reply('❌ 統計情報取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.stats_error', 'statsコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /check - 手動チェック実行
    this.bot.command('check', async ctx => {
      try {
        await ctx.reply('🔍 手動チェックを開始します...');
        const result = await scheduler.runManualCheck();

        const message = [
          '✅ 手動チェック完了',
          '',
          '📊 結果',
          `  • チェックしたURL: ${result.urlCount}件`,
          `  • 成功: ${result.successCount}件`,
          `  • エラー: ${result.errorCount}件`,
          `  • 新着検知: ${result.newPropertyCount > 0 ? `🆕 ${result.newPropertyCount}件` : 'なし'}`,
          `  • 実行時間: ${(result.executionTime / 1000).toFixed(1)}秒`,
        ].join('\n');
        await ctx.reply(message, { parse_mode: 'HTML' });
      } catch (error) {
        await ctx.reply('❌ 手動チェック中にエラーが発生しました');
        vibeLogger.error('telegram.command.check_error', 'checkコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /help - コマンド一覧
    this.bot.command('help', async ctx => {
      const message = [
        '📚 利用可能なコマンド',
        '',
        '/status - 現在の監視状況を表示',
        '/stats  - 詳細な統計情報を表示',
        '/check  - 手動でチェックを実行',
        '/help   - このヘルプメッセージを表示',
        '',
        '🔔 自動通知について',
        '• 新着物件検知時: 即座に通知',
        '• 1時間ごと: サマリーレポート',
        '• エラー時: 3回連続エラーで警告',
        '',
        '📧 サポート',
        '問題が発生した場合は管理者にお問い合わせください',
      ].join('\n');
      await ctx.reply(message, { parse_mode: 'HTML' });
    });

    // /start - ウェルカムメッセージ
    this.bot.command('start', async ctx => {
      const message = [
        '👋 ソクブツMVPへようこそ！',
        '',
        'このBotは不動産サイトの新着物件を監視し、',
        'リアルタイムで通知します。',
        '',
        '利用可能なコマンドを見るには /help を入力してください。',
        '',
        '監視は自動的に5分間隔で実行されています。',
      ].join('\n');
      await ctx.reply(message, { parse_mode: 'HTML' });
    });

    // 不明コマンド対応（先に定義したコマンドにマッチしない場合）
    this.bot.on('message:text', async ctx => {
      const text = ctx.message?.text ?? '';
      if (text.startsWith('/')) {
        const known = ['/status', '/stats', '/check', '/help', '/start'];
        const name = (text.split(' ')[0] ?? '').trim();
        if (!known.includes(name)) {
          const msg = [
            '❓ 不明なコマンドです。',
            '',
            '利用可能なコマンド:',
            '/status, /stats, /check, /help, /start',
          ].join('\n');
          await ctx.reply(msg, { parse_mode: 'HTML' });
        }
      }
    });
  }

  /**
   * Botを起動
   */
  async launchBot(): Promise<void> {
    // 起動を堅牢化: Webhook解除 → 接続検証 → 起動（リトライ）
    // 失敗時はthrowして呼び出し元に伝播させる
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: unknown = null;

    // Webhookが残っているとPollingが無音になるため、念のため解除
    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      vibeLogger.info('telegram.webhook_deleted', 'Webhook解除完了（Polling前初期化）');
    } catch (e) {
      // 解除に失敗しても続行（ログのみ）
      vibeLogger.warn('telegram.webhook_delete_failed', 'Webhook解除に失敗しましたが続行します', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    // 起動前の疎通確認
    try {
      await this.bot.api.getMe();
      vibeLogger.info('telegram.prelaunch_ok', '起動前疎通確認OK');
    } catch (e) {
      vibeLogger.error('telegram.prelaunch_failed', '起動前疎通確認に失敗', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
      lastError = e;
    }

    while (attempt < maxAttempts) {
      attempt++;
      try {
        await this.bot.start();
        vibeLogger.info('telegram.bot_launched', 'Telegram Bot起動完了', {
          context: { attempt },
        });
        this.running = true;
        // 利便性向上: コマンド候補をTelegram側に登録
        try {
          await this.bot.api.setMyCommands([
            { command: 'status', description: '現在の監視状況を表示' },
            { command: 'stats', description: '詳細な統計情報を表示' },
            { command: 'check', description: '手動でチェックを実行' },
            { command: 'help', description: 'コマンド一覧を表示' },
            { command: 'start', description: 'Botの使い方ガイド' },
          ]);
          vibeLogger.info('telegram.commands_set', 'Botコマンドを登録しました');
        } catch (e) {
          vibeLogger.warn('telegram.commands_set_failed', 'Botコマンド登録に失敗しました', {
            context: { error: e instanceof Error ? e.message : String(e) },
          });
        }
        return;
      } catch (error) {
        lastError = error;
        vibeLogger.error('telegram.bot_launch_error', 'Telegram Bot起動エラー', {
          context: {
            attempt,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        // 指数バックオフで再試行
        const delay = Math.pow(2, attempt - 1) * 1000;
        await this.sleep(delay);
      }
    }

    // ここに来たら失敗のためthrow
    throw lastError instanceof Error
      ? lastError
      : new Error(lastError instanceof Error ? lastError.message : 'telegram launch failed');
  }

  /**
   * Botを停止
   */
  async stopBot(): Promise<void> {
    try {
      await this.bot.stop();
    } catch (e) {
      vibeLogger.warn('telegram.bot_stop_error', 'Telegram Bot停止時に警告', {
        context: { error: e instanceof Error ? e.message : String(e) },
      });
    }
    vibeLogger.info('telegram.bot_stopped', 'Telegram Bot停止');
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
