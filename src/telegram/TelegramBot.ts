import { Telegraf, Context } from 'telegraf';
import { UserService } from '../services/UserService.js';
import { vibeLogger } from '../logger.js';

interface BotContext extends Context {
  userId?: string;
}

export class TelegramBot {
  private readonly bot: Telegraf<BotContext>;
  private readonly userService: UserService;

  constructor(botToken: string) {
    this.bot = new Telegraf<BotContext>(botToken);
    this.userService = new UserService();
    this.setupCommands();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // ユーザー認証ミドルウェア
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        const user = await this.userService.registerOrGetUser(
          ctx.from.id.toString(),
          ctx.from.username
        );
        ctx.userId = user.id;
      }
      return next();
    });
  }

  private setupCommands(): void {
    // /start - サービス開始
    this.bot.command('start', async ctx => {
      const welcomeMessage = `
🏠 *ソクブツへようこそ！*

新着物件を見逃さない監視サービスです。

📋 *利用可能なコマンド*
/register \\<URL\\> \\<名前\\> \\<都道府県\\> \\- URL登録
/list \\- 登録URL一覧
/pause \\<番号\\> \\- 監視一時停止
/resume \\<番号\\> \\- 監視再開
/delete \\<番号\\> \\- URL削除
/status \\- 監視状況確認
/help \\- ヘルプ表示

🎯 *最大3件のURLを登録できます*
📍 *1都道府県につき1URLまで*

まずは /register コマンドでURLを登録してください！
      `;

      await ctx.replyWithMarkdownV2(this.escapeMarkdown(welcomeMessage));
    });

    // /register - URL登録
    this.bot.command('register', async ctx => {
      const args = ctx.message.text.split(' ').slice(1);

      if (args.length < 3) {
        await ctx.reply(
          '❌ 使用方法: /register <URL> <名前> <都道府県>\n\n' +
            '例: /register https://www.athome.co.jp/... "広島の物件" "広島県"'
        );
        return;
      }

      const [url, name, prefecture] = args;

      // URL形式チェック
      try {
        new URL(url ?? '');
      } catch {
        await ctx.reply('❌ 無効なURL形式です');
        return;
      }

      if (!ctx.userId) {
        await ctx.reply('❌ ユーザー情報を取得できませんでした');
        return;
      }

      const result = await this.userService.registerUrl(
        ctx.userId,
        url ?? '',
        name ?? '',
        prefecture ?? ''
      );

      if (result.success) {
        await ctx.reply(`✅ ${result.message}\n\n📊 監視を開始しました！`);
      } else {
        await ctx.reply(`❌ ${result.message}`);
      }
    });

    // /list - URL一覧
    this.bot.command('list', async ctx => {
      if (!ctx.userId) {
        await ctx.reply('❌ ユーザー情報を取得できませんでした');
        return;
      }
      const urls = await this.userService.getUserUrls(ctx.userId);

      if (urls.length === 0) {
        await ctx.reply(
          '📝 登録されているURLはありません\n\n/register コマンドでURLを登録してください'
        );
        return;
      }

      let message = '📋 *登録URL一覧*\n\n';
      urls.forEach((url, index) => {
        const status = url.isMonitoring ? '🟢 監視中' : '🔴 停止中';
        message += `${index + 1}\\. *${this.escapeMarkdown(url.name)}*\n`;
        message += `   ${status} \\| ${this.escapeMarkdown(url.prefecture)}\n`;
        message += `   ${this.escapeMarkdown(url.url.substring(0, 50))}\\.\\.\\.\n\n`;
      });

      message += '💡 *操作方法*\n';
      message += '/pause \\<番号\\> \\- 一時停止\n';
      message += '/resume \\<番号\\> \\- 再開\n';
      message += '/delete \\<番号\\> \\- 削除';

      await ctx.replyWithMarkdownV2(message);
    });

    // /pause - 監視一時停止
    this.bot.command('pause', async ctx => {
      await this.handleToggleCommand(ctx, 'pause');
    });

    // /resume - 監視再開
    this.bot.command('resume', async ctx => {
      await this.handleToggleCommand(ctx, 'resume');
    });

    // /delete - URL削除
    this.bot.command('delete', async ctx => {
      const args = ctx.message.text.split(' ').slice(1);

      if (args.length === 0) {
        await ctx.reply('❌ 使用方法: /delete <番号>\n\n/list で番号を確認してください');
        return;
      }

      const index = parseInt(args[0] ?? '') - 1;
      if (!ctx.userId) {
        await ctx.reply('❌ ユーザー情報を取得できませんでした');
        return;
      }
      const urls = await this.userService.getUserUrls(ctx.userId);

      if (index < 0 || index >= urls.length) {
        await ctx.reply('❌ 無効な番号です');
        return;
      }

      const urlId = urls[index]?.id;
      if (!urlId) {
        await ctx.reply('❌ URL IDを取得できませんでした');
        return;
      }
      const result = await this.userService.deleteUrl(ctx.userId, urlId);
      await ctx.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    });

    // /status - 監視状況確認
    this.bot.command('status', async ctx => {
      if (!ctx.userId) {
        await ctx.reply('❌ ユーザー情報を取得できませんでした');
        return;
      }
      const urls = await this.userService.getUserUrls(ctx.userId);

      if (urls.length === 0) {
        await ctx.reply('📝 登録されているURLはありません');
        return;
      }

      let message = '📊 *監視状況*\n\n';
      urls.forEach((url, index) => {
        const status = url.isMonitoring ? '🟢 監視中' : '🔴 停止中';
        message += `${index + 1}\\. *${this.escapeMarkdown(url.name)}*\n`;
        message += `   ${status}\n`;
        message += `   📈 総チェック: ${url.totalChecks}回\n`;
        message += `   🆕 新着検知: ${url.newListingsCount}回\n`;
        message += `   ⚠️ エラー: ${url.errorCount}回\n`;
        if (url.lastCheckedAt) {
          message += `   🕐 最終チェック: ${new Date(url.lastCheckedAt).toLocaleString('ja-JP')}\n`;
        }
        message += '\n';
      });

      await ctx.replyWithMarkdownV2(message);
    });

    // /help - ヘルプ
    this.bot.command('help', async ctx => {
      const helpMessage = `
📖 *ソクブツ ヘルプ*

🔧 *基本コマンド*
/start \\- サービス開始
/register \\<URL\\> \\<名前\\> \\<都道府県\\> \\- URL登録
/list \\- 登録URL一覧
/status \\- 監視状況確認

⚙️ *管理コマンド*
/pause \\<番号\\> \\- 監視一時停止
/resume \\<番号\\> \\- 監視再開
/delete \\<番号\\> \\- URL削除

📋 *制限事項*
• 最大3件のURLまで登録可能
• 1都道府県につき1URLまで
• 監視間隔は5分固定

💡 *使用例*
/register https://www\\.athome\\.co\\.jp/chintai/hiroshima/list/ "広島の物件" "広島県"

❓ *サポート*
問題が発生した場合は管理者にお問い合わせください。
      `;

      await ctx.replyWithMarkdownV2(this.escapeMarkdown(helpMessage));
    });
  }

  private async handleToggleCommand(ctx: BotContext, action: 'pause' | 'resume'): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('❌ メッセージを取得できませんでした');
      return;
    }
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length === 0) {
      await ctx.reply(`❌ 使用方法: /${action} <番号>\n\n/list で番号を確認してください`);
      return;
    }

    const index = parseInt(args[0] ?? '') - 1;
    if (!ctx.userId) {
      await ctx.reply('❌ ユーザー情報を取得できませんでした');
      return;
    }
    const urls = await this.userService.getUserUrls(ctx.userId);

    if (index < 0 || index >= urls.length) {
      await ctx.reply('❌ 無効な番号です');
      return;
    }

    const targetUrl = urls[index];
    if (!targetUrl) {
      await ctx.reply('❌ 指定されたURLが見つかりません');
      return;
    }
    const shouldBeMonitoring = action === 'resume';

    if (targetUrl.isMonitoring === shouldBeMonitoring) {
      const status = shouldBeMonitoring ? '監視中' : '停止中';
      await ctx.reply(`ℹ️ 「${targetUrl.name ?? '不明'}」は既に${status}です`);
      return;
    }

    const urlId = targetUrl.id;
    if (!urlId) {
      await ctx.reply('❌ URL IDを取得できませんでした');
      return;
    }
    const result = await this.userService.toggleUrlMonitoring(ctx.userId, urlId);
    await ctx.reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  async start(): Promise<void> {
    await this.bot.launch();
    vibeLogger.info('telegram.bot_started', 'Telegram Bot起動完了', {
      humanNote: 'ユーザーからのコマンドを受付開始',
    });
  }

  stop(): void {
    this.bot.stop();
  }
}
