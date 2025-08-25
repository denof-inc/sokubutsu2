import { Telegraf } from 'telegraf';
import { NotificationData, Statistics, UrlStatistics } from './types.js';
import { vibeLogger } from './logger.js';
import { UserService } from './services/UserService.js';
import https from 'https';
import http from 'http';
import dns from 'dns';

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
    // Node-fetch v2 経由の接続で IPv6 経路がタイムアウトする環境があるため、IPv4 を優先する lookup を明示
    const ipv4Lookup = (
      hostname: string,
      options: any,
      callback: any
    ) => {
      const cb = typeof options === 'function' ? options : callback;
      const baseOpts = typeof options === 'object' && options !== null ? options : {};
      // all フラグなど既存オプションを維持しつつ IPv4 を強制
      const finalOpts = { ...baseOpts, family: 4 };
      return (dns.lookup as any)(hostname, finalOpts, cb);
    };

    const httpsAgent = new https.Agent({ keepAlive: true, lookup: ipv4Lookup as any });

    this.bot = new Telegraf(botToken, {
      telegram: {
        webhookReply: false,
        // node-fetch v2 互換: HTTPS 用の Agent を指定（IPv4 優先 lookup）
        agent: httpsAgent as any,
      },
      handlerTimeout: 90000,
    });
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
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : { message: String(error) },
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
    const message = `🚀 ソクブツMVP起動完了

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
  async sendNewListingNotification(data: NotificationData): Promise<void> {
    const changeCount = data.currentCount - data.previousCount;
    const changeIcon = changeCount > 0 ? '🆕' : '📉';
    const changeText = changeCount > 0 ? `+${changeCount}件` : `${Math.abs(changeCount)}件減少`;

    // URLから地域情報を抽出
    const match = data.url.match(/\/(chintai|buy_other)\/([^/]+)\//); 
    const area = match ? match[2] : 'unknown';
    
    // URLを短縮表示用にフォーマット
    const shortUrl = this.formatUrlForDisplay(data.url);
    
    const message = `🆕 *新着物件あり*

📍 *エリア*: ${area}
🔗 [物件を見る](${data.url})
⏰ *検知時刻*: ${data.detectedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

    await this.sendMessage(message);
  }

  /**
   * エラー通知
   */
  async sendErrorAlert(url: string, error: string): Promise<void> {
    // URLから地域情報を抽出
    const match = url.match(/\/(chintai|buy_other)\/([^/]+)\//); 
    const area = match ? match[2] : 'unknown';
    
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

📍 監視名: ${area}エリア物件
⏰ 時間: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
🔢 エラー数: 3回連続（15分間）
❌ エラー内容: ${userFriendlyError}

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
      const prefecture = match ? match[2] : 'unknown';
      
      const now = new Date();
      const currentTime = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      
      // URLを短縮表示
      const shortUrl = this.formatUrlForDisplay(stats.url);
      
      let message = `📊 1時間サマリー

📍 エリア: ${prefecture}
⏰ 時刻: ${currentTime}

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
          message += `• ${entry.time} ${icon} ${entry.status}
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
🔗 [${shortUrl}](${stats.url})`;
      
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
   * URLを表示用にフォーマット（短縮表示）
   */
  private formatUrlForDisplay(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // athome.co.jpの場合の特別処理
      if (hostname.includes('athome.co.jp')) {
        const pathMatch = urlObj.pathname.match(/\/(chintai|buy_other)\/([^/]+)\//);
        if (pathMatch) {
          const type = pathMatch[1] === 'chintai' ? '賃貸' : '売買';
          const area = pathMatch[2];
          return `athome.co.jp - ${type} (${area})`;
        }
      }
      
      // その他のサイトは短縮表示
      return hostname.length > 20 ? `${hostname.substring(0, 17)}...` : hostname;
    } catch {
      return url.length > 30 ? `${url.substring(0, 27)}...` : url;
    }
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Bot情報を取得
   */
  async getBotInfo(): Promise<{ username: string; id: number }> {
    const me = await this.bot.telegram.getMe();
    return {
      username: me.username ?? 'unknown',
      id: me.id,
    };
  }

  /**
   * コマンドハンドラーの設定（マルチユーザーモードのみ）
   */
  setupCommandHandlers(scheduler: any, userService: UserService): void {
    this.setupMultiUserCommands(scheduler, userService);
  }


  /**
   * マルチユーザーモードコマンド（新規）
   */
  private setupMultiUserCommands(scheduler: any, userService: UserService): void {
    // /register - ユーザー登録
    this.bot.command('register', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        const username = ctx.from?.username;

        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, username);
        
        let message = `🎉 登録完了！\n\n`;
        message += `👤 ユーザーID: ${user.id}\n`;
        message += `📞 Chat ID: ${chatId}\n`;
        if (username) {
          message += `👨‍💼 ユーザー名: @${username}\n`;
        }
        message += `\n使い方は /help を参照してください。`;
        
        await ctx.reply(message);
        
        vibeLogger.info('telegram.user.registered', 'ユーザー登録完了', {
          context: { userId: user.id, chatId, username },
        });
      } catch (error) {
        await ctx.reply('❌ 登録中にエラーが発生しました');
        vibeLogger.error('telegram.command.register_error', 'registerコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /add - URL追加
    this.bot.command('add', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, ctx.from?.username);
        if (!user?.id) {
          await ctx.reply('❌ ユーザー情報を取得できませんでした');
          return;
        }
        
        const args = ctx.message?.text?.split(' ').slice(1) || [];
        
        if (args.length < 2) {
          const usage = '使用方法: /add URL 監視名\n\n例: /add https://www.athome.co.jp/... 新宿エリア物件';
          await ctx.reply(usage);
          return;
        }

        const url = args[0]!;
        const name = args.slice(1).join(' ');

        // URLから都道府県を推定（簡易実装）
        const prefecture = this.extractPrefectureFromUrl(url);
        
        const result = await userService.registerUrl(user.id, url, name, prefecture);
        
        if (result.success) {
          let message = `✅ URL登録成功！\n\n`;
          message += `📍 監視名: ${name}\n`;
          message += `🌍 都道府県: ${prefecture}\n`;
          message += `🔗 URL: ${url}\n\n`;
          message += `監視は自動的に開始されます。`;
          
          await ctx.reply(message);
        } else {
          await ctx.reply(`❌ ${result.message}`);
        }
      } catch (error) {
        await ctx.reply('❌ URL追加中にエラーが発生しました');
        vibeLogger.error('telegram.command.add_error', 'addコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /list - 登録URL一覧
    this.bot.command('list', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, ctx.from?.username);
        if (!user?.id) {
          await ctx.reply('❌ ユーザー情報を取得できませんでした');
          return;
        }
        
        const urls = await userService.getUserUrls(user.id);

        if (urls.length === 0) {
          const noData = '📝 登録されたURLはありません。\n\n/add でURLを追加してください。';
          await ctx.reply(noData);
          return;
        }

        const lines: string[] = [];
        lines.push('📋 登録URL一覧');
        lines.push('');
        urls.forEach((url, i) => {
          if (!url) return;
          const status = url.isMonitoring ? '🔄 監視中' : '⏸ 停止中';
          lines.push(`${i + 1}. ${url.name}`);
          lines.push(`   ${status}`);
          lines.push(`   📊 チェック: ${url.totalChecks}回`);
          lines.push(`   🆕 新着: ${url.newListingsCount}件`);
          lines.push(`   ID: ${url.id}`);
          lines.push('');
        });
        lines.push('操作方法:');
        lines.push('• 停止: /pause ID');
        lines.push('• 再開: /resume ID');
        lines.push('• 削除: /delete ID');

        await ctx.reply(lines.join('\n'));
      } catch (error) {
        await ctx.reply('❌ URL一覧取得中にエラーが発生しました');
        vibeLogger.error('telegram.command.list_error', 'listコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /pause - 監視一時停止
    this.bot.command('pause', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, ctx.from?.username);
        if (!user?.id) {
          await ctx.reply('❌ ユーザー情報を取得できませんでした');
          return;
        }
        
        const args = ctx.message?.text?.split(' ').slice(1) || [];
        
        if (args.length === 0) {
          const usage = '使用方法: /pause URL_ID\n\nURL IDは /list で確認できます。';
          await ctx.reply(usage);
          return;
        }

        const urlId = args[0]!;
        const result = await userService.toggleUrlMonitoring(user.id, urlId);
        
        const msg = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        await ctx.reply(msg);
      } catch (error) {
        await ctx.reply('❌ 監視停止中にエラーが発生しました');
        vibeLogger.error('telegram.command.pause_error', 'pauseコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /resume - 監視再開
    this.bot.command('resume', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, ctx.from?.username);
        if (!user?.id) {
          await ctx.reply('❌ ユーザー情報を取得できませんでした');
          return;
        }
        
        const args = ctx.message?.text?.split(' ').slice(1) || [];
        
        if (args.length === 0) {
          const usage = '使用方法: /resume URL_ID\n\nURL IDは /list で確認できます。';
          await ctx.reply(usage);
          return;
        }

        const urlId = args[0]!;
        const result = await userService.toggleUrlMonitoring(user.id, urlId);
        
        const msg = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        await ctx.reply(msg);
      } catch (error) {
        await ctx.reply('❌ 監視再開中にエラーが発生しました');
        vibeLogger.error('telegram.command.resume_error', 'resumeコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    // /delete - URL削除
    this.bot.command('delete', async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply('❌ チャット情報を取得できませんでした');
          return;
        }

        const user = await userService.registerOrGetUser(chatId, ctx.from?.username);
        if (!user?.id) {
          await ctx.reply('❌ ユーザー情報を取得できませんでした');
          return;
        }
        
        const args = ctx.message?.text?.split(' ').slice(1) || [];
        
        if (args.length === 0) {
          const usage = '使用方法: /delete URL_ID\n\nURL IDは /list で確認できます。';
          await ctx.reply(usage);
          return;
        }

        const urlId = args[0]!;
        const result = await userService.deleteUrl(user.id, urlId);
        
        const msg = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        await ctx.reply(msg);
      } catch (error) {
        await ctx.reply('❌ URL削除中にエラーが発生しました');
        vibeLogger.error('telegram.command.delete_error', 'deleteコマンドエラー', {
          context: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    this.setupCommonCommands();
  }

  /**
   * 共通コマンド（マルチユーザーモード専用）
   */
  private setupCommonCommands(): void {
    // /help - コマンド一覧
    this.bot.command('help', async (ctx) => {
      let message = `📚 利用可能なコマンド

/register - ユーザー登録
/add <URL> <名前> - URL追加
/list - 登録URL一覧
/pause <ID> - 監視停止
/resume <ID> - 監視再開
/delete <ID> - URL削除
/help - このヘルプメッセージを表示

🔔 自動通知について
• 新着物件検知時: 即座に通知
• 1時間ごと: サマリーレポート
• エラー時: 3回連続エラーで警告

📧 サポート
問題が発生した場合は管理者にお問い合わせください`;
      
      await ctx.reply(message);
    });

    // /start - ウェルカムメッセージ
    this.bot.command('start', async (ctx) => {
      let message = `👋 ソクブツMVPへようこそ！

このBotは不動産サイトの新着物件を監視し、
リアルタイムで通知します。

まず /register でユーザー登録を行い、
その後 /add でURL監視を開始してください。

利用可能なコマンドを見るには /help を入力してください。`;
      
      await ctx.reply(message);
    });
  }

  /**
   * URLから都道府県を推定（簡易実装）
   */
  private extractPrefectureFromUrl(url: string): string {
    const prefectureMap: { [key: string]: string } = {
      'tokyo': '東京都',
      'osaka': '大阪府',
      'kyoto': '京都府',
      'kanagawa': '神奈川県',
      'chiba': '千葉県',
      'saitama': '埼玉県',
      'aichi': '愛知県',
      'fukuoka': '福岡県',
      'hokkaido': '北海道',
      'hyogo': '兵庫県',
    };

    for (const [key, value] of Object.entries(prefectureMap)) {
      if (url.includes(key)) {
        return value;
      }
    }

    return 'その他';
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
      throw error; // エラーを再throwしてmain.tsでキャッチ可能にする
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
