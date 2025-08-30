import { Bot, webhookCallback } from 'grammy';
import type { RequestHandler } from 'express';
import { NotificationData, Statistics, UrlStatistics } from './types.js';
import { vibeLogger } from './logger.js';
import { config } from './config.js';
import { UserService } from './services/UserService.js';

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
  private readonly userService = new UserService();

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
   * 監視名を対象URLにリンクさせる（HTML）
   */
  private createUrlLink(name: string, url: string): string {
    const escapedName = this.escapeHtml(name);
    const safeUrl = this.escapeHtml(url);
    return `<a href="${safeUrl}">${escapedName}</a>`;
  }

  private shortId(id: string): string {
    const compact = id.replace(/-/g, '');
    return compact.slice(0, 4);
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

📍 監視名: ${this.createUrlLink(displayName, data.url)}
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

📍 監視名: ${this.createUrlLink(displayName, url)}
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

      // 履歴（間隔に依存しない表現）
      if (stats.hourlyHistory && stats.hourlyHistory.length > 0) {
        message += `📝 検知結果:
`;
        for (const entry of stats.hourlyHistory) {
          // アイコン統一: あり=✅ / なし=❌ / エラー=⚠️
          let icon = '❌';
          if (entry.status === 'あり') icon = '✅';
          else if (entry.status === 'エラー') icon = '⚠️';
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
🔗 ${this.createUrlLink(stats.name, stats.url)}`;

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

  /**
   * Webhook情報取得
   */
  async getWebhookInfo(): Promise<{
    url: string | null;
    hasCustomCertificate?: boolean;
    pendingUpdateCount?: number;
  }> {
    // Telegram APIのgetWebhookInfoをそのまま呼び出す
    // 返却値はWebhookInfo（urlが未設定なら空文字or nullのケースがあるため正規化）
    const info = await this.bot.api.getWebhookInfo();
    return {
      url: info.url || null,
      hasCustomCertificate: (info as any).has_custom_certificate,
      pendingUpdateCount: (info as any).pending_update_count,
    };
  }

  /**
   * 期待するURLにWebhookが設定されているか検証し、必要に応じて修復する
   * @returns changed: 再設定を実行したかどうか
   */
  async ensureWebhook(
    expectedUrl: string
  ): Promise<{ ok: boolean; changed: boolean; currentUrl: string | null }> {
    try {
      const info = await this.getWebhookInfo();
      const current = info.url;
      if (current !== expectedUrl) {
        await this.setWebhook(expectedUrl, true);
        vibeLogger.warn('telegram.webhook_guard.reset', 'Webhook URL不一致のため再設定しました', {
          context: { expectedUrl, currentUrl: current },
          humanNote: '自己修復ガードがWebhookを再設定',
        });
        return { ok: true, changed: true, currentUrl: expectedUrl };
      }
      return { ok: true, changed: false, currentUrl: current };
    } catch (error) {
      vibeLogger.error('telegram.webhook_guard.error', 'Webhook検証/再設定でエラー', {
        context: { error: error instanceof Error ? error.message : String(error), expectedUrl },
      });
      return { ok: false, changed: false, currentUrl: null };
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
    // 受信メッセージの観測ログ（診断用）: ログのみ。処理は command ハンドラへ委譲
    this.bot.on('message:text', async (ctx, next) => {
      const text = ctx.message?.text ?? '';
      const chat = ctx.chat?.type ?? 'unknown';
      vibeLogger.info('telegram.update_received', 'テキストメッセージ受信', {
        context: { text, chat, from: ctx.from?.id },
      });
      await next();
    });

    // コマンドメニューをTelegram側に登録（クライアントのコマンド一覧に出す）
    void this.bot.api
      .setMyCommands([
        { command: 'help', description: 'ヘルプ' },
        { command: 'status', description: '監視状況を表示' },
        { command: 'stats', description: '各URLの統計を表示' },
        { command: 'check', description: '手動チェックを実行' },
        { command: 'add', description: 'URLを追加 (/add <URL> <名前>)' },
        { command: 'resume', description: '監視を再開 (/resume <ID>)' },
        { command: 'delete', description: 'URL削除 (/delete <ID>)' },
      ])
      .catch(e => {
        vibeLogger.warn('telegram.set_my_commands_failed', 'コマンドメニュー登録に失敗', {
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      });
    // Bot全体のエラーハンドリング（予期せぬ例外の可視化）
    this.bot.catch(err => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      vibeLogger.error('telegram.global_error', 'Telegramハンドラ内で未処理エラー', {
        context: {
          error: errorMsg,
        },
      });
    });

    this.bot.command('resume', async ctx => {
      try {
        const text = ctx.message?.text ?? '';
        const id = text.split(/\s+/)[1];
        if (!id) {
          await ctx.reply('❌ 形式: /resume <URL-ID>');
          return;
        }
        const chatId = String(ctx.chat?.id ?? '');
        const username = ctx.from?.username;
        const user = await this.userService.registerOrGetUser(chatId, username);
        const urls = await this.userService.getUserUrls(user.id);
        const target = urls.find(u => this.shortId(u.id) === id || u.id.startsWith(id));
        if (!target) {
          await ctx.reply('❌ 指定IDのURLが見つかりません');
          return;
        }
        if (target.isMonitoring) {
          await ctx.reply(`✅ 既に稼働中です: ${target.name}`);
          return;
        }
        const result = await this.userService.toggleUrlMonitoring(user.id, id);
        if (result.success) {
          await ctx.reply(`▶️ 監視を再開しました: ${target.name}`);
        } else {
          await ctx.reply(`❌ エラー: ${result.message}`);
        }
      } catch (error) {
        vibeLogger.error('telegram.command.resume_error', 'resumeコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
        await ctx.reply('❌ 再開に失敗しました');
      }
    });

    // /delete - URL削除（4文字ID対応）
    this.bot.command('delete', async ctx => {
      try {
        const text = ctx.message?.text ?? '';
        const id = text.split(/\s+/)[1];
        if (!id) {
          await ctx.reply('❌ 形式: /delete <URL-ID>');
          return;
        }
        const chatId = String(ctx.chat?.id ?? '');
        const username = ctx.from?.username;
        const user = await this.userService.registerOrGetUser(chatId, username);
        const urls = await this.userService.getUserUrls(user.id);
        const target = urls.find(u => this.shortId(u.id) === id || u.id.startsWith(id));
        if (!target) {
          await ctx.reply('❌ 指定IDのURLが見つかりません');
          return;
        }
        const result = await this.userService.deleteUrl(user.id, target.id);
        if (result.success) {
          await ctx.reply('🗑️ URLを削除しました');
        } else {
          await ctx.reply(`❌ エラー: ${result.message}`);
        }
      } catch (error) {
        vibeLogger.error('telegram.command.delete_error', 'deleteコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
        await ctx.reply('❌ 削除に失敗しました');
      }
    });

    // /stats - 登録URLごとの統計一覧
    this.bot.command('stats', async ctx => {
      try {
        const chatId = String(ctx.chat?.id ?? '');
        const username = ctx.from?.username;
        const user = await this.userService.registerOrGetUser(chatId, username);
        const urls = await this.userService.getUserUrls(user.id);

        const lines: string[] = ['📈 統計情報', ''];
        if (urls.length === 0) {
          lines.push('登録URLがありません');
        } else {
          for (const u of urls) {
            const nameLink = `<a href="${this.escapeHtml(u.url)}">${this.escapeHtml(u.name)}</a>`;
            const total = u.totalChecks;
            const errors = u.errorCount;
            const success = Math.max(0, total - errors);
            const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '—';
            const last = u.lastCheckedAt
              ? new Date(String(u.lastCheckedAt)).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })
              : '—';
            lines.push(
              `${nameLink}`,
              `  • 総チェック数: ${total}回`,
              `  • エラー数: ${errors}回`,
              `  • 新着検知: ${u.newListingsCount}回`,
              `  • 成功率: ${rate}%`,
              `  • 監視間隔: ${this.escapeHtml(config.monitoring.interval)}`,
              `  • 最終チェック: ${this.escapeHtml(last)}`,
              ''
            );
          }
        }
        await ctx.reply(lines.join('\n'.replace('\\n', '\n')), { parse_mode: 'HTML' });
      } catch (error) {
        await ctx.reply('❌ 統計情報取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.stats_error', 'statsコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });
    // /check - 手動チェック実行（Webhookをブロックしない非同期実行）
    this.bot.command('check', async ctx => {
      try {
        await ctx.reply('🔍 手動チェックを開始します...');
        void (async () => {
          try {
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
            ].join('\n'.replace('\\n', '\n'));
            await ctx.reply(message, { parse_mode: 'HTML' });
          } catch (err) {
            await ctx.reply('❌ 手動チェックのバックグラウンド実行でエラーが発生しました');
            vibeLogger.error('telegram.command.check_error_bg', 'checkコマンドBGエラー', {
              context: { error: err instanceof Error ? err.message : String(err) },
            });
          }
        })();
      } catch (error) {
        await ctx.reply('❌ 手動チェックの開始に失敗しました');
        vibeLogger.error('telegram.command.check_error', 'checkコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /add - 監視URL追加（名前必須）
    this.bot.command('add', async ctx => {
      try {
        const text = ctx.message?.text ?? '';
        const parts = text.split(/\s+/).slice(1);
        const urlIndex = parts.findIndex(p => /^https?:\/\//i.test(p));
        if (urlIndex === -1) {
          await ctx.reply('❌ 形式: /add <URL> <名前>');
          return;
        }
        const url = String(parts[urlIndex] ?? '');
        const name = parts
          .slice(urlIndex + 1)
          .join(' ')
          .trim();
        if (!name) {
          await ctx.reply('❌ 名前を指定してください。形式: /add <URL> <名前>');
          return;
        }
        const match = url.match(/\/(chintai|buy_other)\/([^/]+)\//);
        const prefecture = match?.[2] ?? 'unknown';
        const displayName = name || prefecture;

        const chatId = String(ctx.chat?.id ?? '');
        const username = ctx.from?.username;
        const user = await this.userService.registerOrGetUser(chatId, username);
        const result = await this.userService.registerUrl(user.id, url, displayName, prefecture);
        if (result.success && result.userUrl) {
          await ctx.reply(
            [
              '✅ 監視URL追加完了',
              `ID: ${this.shortId(result.userUrl.id)}`,
              `📍 名前: ${result.userUrl.name}`,
              `🔗 URL: ${result.userUrl.url}`,
              '🕐 監視間隔: 5分',
            ].join('\n'),
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(`❌ エラー: ${result.message}`);
        }
      } catch (error) {
        vibeLogger.error('telegram.command.add_error', 'addコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
        await ctx.reply('❌ 追加に失敗しました');
      }
    });

    // /status - 現在の監視状況（各監視の要約一覧）
    this.bot.command('status', async ctx => {
      try {
        const lines: string[] = ['📊 監視状況', ''];
        const chatId = String(ctx.chat?.id ?? '');
        const username = ctx.from?.username;
        const user = await this.userService.registerOrGetUser(chatId, username);
        const urls = await this.userService.getUserUrls(user.id);
        if (urls.length === 0) {
          lines.push('（登録なし）');
        } else {
          urls.forEach((u, idx) => {
            const state = u.isMonitoring ? '✅' : '⏸️';
            const idShort = this.shortId(u.id);
            const nameLink = `<a href="${this.escapeHtml(u.url)}">${this.escapeHtml(u.name)}</a>`;
            const last = u.lastCheckedAt
              ? new Date(String(u.lastCheckedAt)).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })
              : '—';
            lines.push(
              `${idx + 1}. ${state} ID: ${idShort} | ${nameLink} | 最終チェック: ${this.escapeHtml(last)}`
            );
          });
        }
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
      } catch (error) {
        await ctx.reply('❌ ステータス取得に失敗しました');
        vibeLogger.error('telegram.command.status_error', 'statusコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /help - コマンド一覧
    this.bot.command('help', async ctx => {
      const message = [
        '📚 利用可能なコマンド',
        '',
        '/status - 監視状況と登録URL一覧',
        '/stats  - 詳細な統計情報',
        '/check  - 手動チェックを実行',
        // HTMLモードのため山括弧はエスケープ
        '/add &lt;URL&gt; &lt;名前&gt;    - URLを追加',
        '/resume &lt;ID&gt;         - 監視を再開',
        '/delete &lt;ID&gt;         - URLを削除',
        '/help   - このヘルプを表示',
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
        const known = [
          '/status',
          '/stats',
          '/check',
          '/help',
          '/start',
          '/add',
          '/resume',
          '/delete',
        ];
        const name = (text.split(' ')[0] ?? '').trim();
        if (!known.includes(name)) {
          const msg = [
            '❓ 不明なコマンドです。',
            '',
            '利用可能なコマンド:',
            '/status, /stats, /check, /add, /resume, /delete, /help, /start',
          ].join('\n');
          await ctx.reply(msg, { parse_mode: 'HTML' });
        }
      }
    });
  }

  // 旧ロングポーリング実装は削除（Webhook運用）

  // Webhookモード: Express用ハンドラを返す
  getWebhookHandler(): RequestHandler {
    return webhookCallback(this.bot, 'express');
  }

  // Webhook設定
  async setWebhook(url: string, dropPending = true): Promise<void> {
    await this.bot.api.setWebhook(url, { drop_pending_updates: dropPending });
    vibeLogger.info('telegram.webhook_set', 'Webhookを設定しました', { context: { url } });
  }

  async deleteWebhook(): Promise<void> {
    await this.bot.api.deleteWebhook({ drop_pending_updates: false });
    vibeLogger.info('telegram.webhook_deleted', 'Webhook解除完了');
  }
}
