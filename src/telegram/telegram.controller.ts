import { 
  Controller, 
  Post, 
  Body, 
  UseGuards,
  Logger,
} from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/guards/telegram-auth.guard';
import { TelegramWebhookGuard } from './guards/telegram-webhook.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { CurrentUser, TelegramUser, IsNewUser } from '../auth/decorators/telegram-user.decorator';
import { User } from '../users/entities/user.entity';
import { TelegramUpdate, TelegramUser as ITelegramUser } from '../auth/interfaces/telegram-user.interface';
import { AuthService } from '../auth/auth.service';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Telegram Webhook エンドポイント
   */
  @Post('webhook')
  @UseGuards(TelegramWebhookGuard, TelegramAuthGuard, RateLimitGuard)
  async handleUpdate(
    @Body() update: TelegramUpdate,
    @CurrentUser() user: User,
    @TelegramUser() telegramUser: ITelegramUser,
    @IsNewUser() isNewUser: boolean,
  ) {
    this.logger.debug(`Received update: ${JSON.stringify(update)}`);

    // メッセージがない場合は無視
    if (!update.message || !update.message.text) {
      return { ok: true };
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    // コマンドの解析
    const command = this.parseCommand(text);
    
    try {
      switch (command.name) {
        case '/start':
          await this.handleStartCommand(chatId, telegramUser, isNewUser);
          break;
          
        case '/add':
          await this.handleAddCommand(chatId, user, command.args);
          break;
          
        case '/list':
          await this.handleListCommand(chatId, user);
          break;
          
        case '/remove':
          await this.handleRemoveCommand(chatId, user, command.args);
          break;
          
        case '/pause':
          await this.handlePauseCommand(chatId, user, command.args);
          break;
          
        case '/resume':
          await this.handleResumeCommand(chatId, user, command.args);
          break;
          
        case '/status':
          await this.handleStatusCommand(chatId, user);
          break;
          
        case '/help':
          await this.handleHelpCommand(chatId);
          break;
          
        default:
          await this.telegramService.sendMessage(
            chatId,
            '不明なコマンドです。/help でコマンド一覧を確認してください。'
          );
      }
    } catch (error) {
      this.logger.error(`Command execution error:`, error);
      await this.telegramService.sendMessage(
        chatId,
        'エラーが発生しました。しばらく待ってから再度お試しください。'
      );
    }

    return { ok: true };
  }

  /**
   * /start コマンドハンドラー
   */
  private async handleStartCommand(
    chatId: number,
    telegramUser: ITelegramUser,
    isNewUser: boolean,
  ) {
    const result = await this.authService.handleStartCommand(telegramUser);
    await this.telegramService.sendMessage(chatId, result.welcomeMessage);
  }

  /**
   * /add コマンドハンドラー
   */
  private async handleAddCommand(
    chatId: number,
    user: User,
    args: string[],
  ) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /add <URL>\n例: /add https://www.example.com/property/123'
      );
      return;
    }

    const url = args[0];
    
    // URL検証
    if (!this.isValidUrl(url)) {
      await this.telegramService.sendMessage(
        chatId,
        '有効なURLを入力してください。'
      );
      return;
    }

    // TODO: URL追加処理を実装
    await this.telegramService.sendMessage(
      chatId,
      `URL "${url}" を監視リストに追加しました！\n新着物件が見つかり次第お知らせします。`
    );
  }

  /**
   * /list コマンドハンドラー
   */
  private async handleListCommand(chatId: number, user: User) {
    // TODO: ユーザーの監視URL一覧を取得
    const message = `
📋 監視中のURL一覧:

1. https://example.com/property/123
   状態: 🟢 監視中
   最終チェック: 5分前

2. https://example.com/property/456
   状態: ⏸️ 一時停止中
   最終チェック: 1時間前

登録数: 2件
    `.trim();

    await this.telegramService.sendMessage(chatId, message);
  }

  /**
   * /remove コマンドハンドラー
   */
  private async handleRemoveCommand(
    chatId: number,
    user: User,
    args: string[],
  ) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /remove <番号>\n/list で番号を確認してください。'
      );
      return;
    }

    const index = parseInt(args[0]);
    if (isNaN(index)) {
      await this.telegramService.sendMessage(
        chatId,
        '番号を正しく入力してください。'
      );
      return;
    }

    // TODO: URL削除処理を実装
    await this.telegramService.sendMessage(
      chatId,
      `番号 ${index} のURLを削除しました。`
    );
  }

  /**
   * /pause コマンドハンドラー
   */
  private async handlePauseCommand(
    chatId: number,
    user: User,
    args: string[],
  ) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /pause <番号>\n/list で番号を確認してください。'
      );
      return;
    }

    const index = parseInt(args[0]);
    if (isNaN(index)) {
      await this.telegramService.sendMessage(
        chatId,
        '番号を正しく入力してください。'
      );
      return;
    }

    // TODO: 監視一時停止処理を実装
    await this.telegramService.sendMessage(
      chatId,
      `番号 ${index} の監視を一時停止しました。`
    );
  }

  /**
   * /resume コマンドハンドラー
   */
  private async handleResumeCommand(
    chatId: number,
    user: User,
    args: string[],
  ) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /resume <番号>\n/list で番号を確認してください。'
      );
      return;
    }

    const index = parseInt(args[0]);
    if (isNaN(index)) {
      await this.telegramService.sendMessage(
        chatId,
        '番号を正しく入力してください。'
      );
      return;
    }

    // TODO: 監視再開処理を実装
    await this.telegramService.sendMessage(
      chatId,
      `番号 ${index} の監視を再開しました。`
    );
  }

  /**
   * /status コマンドハンドラー
   */
  private async handleStatusCommand(chatId: number, user: User) {
    // TODO: ユーザーの監視状況を取得
    const message = `
📊 監視状況:

👤 ユーザー: ${user.fullName}
📅 登録日: ${user.createdAt.toLocaleDateString('ja-JP')}
🔍 監視中URL: 2件
⏸️ 一時停止中: 1件
🔔 通知設定: ${user.settings?.notifications?.enabled ? 'ON' : 'OFF'}

最終チェック: 5分前
次回チェック: 10分後
    `.trim();

    await this.telegramService.sendMessage(chatId, message);
  }

  /**
   * /help コマンドハンドラー
   */
  private async handleHelpCommand(chatId: number) {
    const message = `
📚 コマンド一覧:

/start - ボットを開始
/add <URL> - 監視URLを追加
/list - 登録URL一覧を表示
/remove <番号> - URLを削除
/pause <番号> - 監視を一時停止
/resume <番号> - 監視を再開
/status - 監視状況を確認
/help - このヘルプを表示

❓ 使い方:
1. /add でURLを登録
2. 新着物件があれば自動通知
3. /list で登録状況を確認

お困りの場合は @sokubutsu_support までご連絡ください。
    `.trim();

    await this.telegramService.sendMessage(chatId, message);
  }

  /**
   * コマンドをパース
   */
  private parseCommand(text: string): { name: string; args: string[] } {
    const parts = text.trim().split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    return { name, args };
  }

  /**
   * URL検証
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}