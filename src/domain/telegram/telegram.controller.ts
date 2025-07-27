import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import {
  TelegramAuthGuard,
  TelegramWebhookGuard,
  RateLimitGuard,
} from '../../common/guards';
import {
  CurrentUser,
  TelegramUser,
  IsNewUser,
} from '../../core/auth/decorators/telegram-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  TelegramUpdate,
  TelegramUser as ITelegramUser,
} from '../../common/interfaces';
import { AuthService } from '../../core/auth/auth.service';
import { TelegramService } from './telegram.service';
import { UrlService } from '../url/url.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly telegramService: TelegramService,
    private readonly urlService: UrlService,
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
    @IsNewUser() _isNewUser: boolean,
  ) {
    this.logger.debug(`Received update: ${String(JSON.stringify(update))}`);

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
          await this.handleStartCommand(chatId, telegramUser);
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
            '不明なコマンドです。/help でコマンド一覧を確認してください。',
          );
      }
    } catch (error) {
      this.logger.error(`Command execution error:`, error);
      let errorMessage = '不明なエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      await this.telegramService.sendMessage(
        chatId,
        `エラーが発生しました。しばらく待ってから再度お試しください。${errorMessage}`,
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
  ) {
    const result = await this.authService.handleStartCommand(telegramUser);
    await this.telegramService.sendMessage(chatId, result.welcomeMessage);
  }

  /**
   * /add コマンドハンドラー
   */
  private async handleAddCommand(chatId: number, user: User, args: string[]) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /add <URL> [名前]\n例: /add https://www.example.com/property/123 渋谷の物件',
      );
      return;
    }

    const url = args[0];
    const name = args[1];

    // URL検証
    if (!this.isValidUrl(url)) {
      await this.telegramService.sendMessage(
        chatId,
        '有効なURLを入力してください。',
      );
      return;
    }

    try {
      const addedUrl = await this.urlService.addUrl(user.telegramId, url, name);
      await this.telegramService.sendMessage(
        chatId,
        `✅ 監視URL追加完了\n\n📍 名前: ${addedUrl.name}\n🔗 URL: ${addedUrl.url}\n新着物件が見つかり次第お知らせします。`,
      );
    } catch (error) {
      this.logger.error(`Failed to add URL:`, error);
      let errorMessage = '不明なエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      await this.telegramService.sendMessage(
        chatId,
        `URLの追加に失敗しました: ${errorMessage}`,
      );
    }
  }

  /**
   * /list コマンドハンドラー
   */
  private async handleListCommand(chatId: number, user: User) {
    const urls = await this.urlService.findByUserId(user.telegramId);

    if (urls.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '現在、監視中のURLはありません。/add コマンドで追加してください。',
      );
      return;
    }

    let message = '📋 監視中のURL一覧:\n\n';
    urls.forEach((url, index) => {
      const statusEmoji = url.isActive ? '🟢' : '⏸️';
      const statusText = url.isActive ? '監視中' : '一時停止中';
      const lastChecked = '未チェック';
      message += `${String(index + 1)}. ${url.name}\n   🔗 ${url.url}\n   状態: ${statusEmoji} ${statusText}\n   最終チェック: ${lastChecked}\n\n`;
    });

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
        '使用方法: /remove <URLのID>\n/list でIDを確認してください。',
      );
      return;
    }

    const urlId = args[0]; // IDは文字列として扱う

    try {
      this.urlService.removeUrl(user.telegramId, urlId);
      await this.telegramService.sendMessage(
        chatId,
        `🗑️ URL (ID: ${urlId}) を削除しました。`,
      );
    } catch (error) {
      this.logger.error(`Failed to remove URL:`, error);
      let errorMessage = '不明なエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      await this.telegramService.sendMessage(
        chatId,
        `URLの削除に失敗しました: ${errorMessage}`,
      );
    }
  }

  /**
   * /pause コマンドハンドラー
   */
  private async handlePauseCommand(chatId: number, user: User, args: string[]) {
    if (args.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        '使用方法: /pause <URLのID>\n/list でIDを確認してください。',
      );
      return;
    }

    const urlId = args[0]; // IDは文字列として扱う

    try {
      this.urlService.pauseUrl(user.telegramId, urlId);
      await this.telegramService.sendMessage(
        chatId,
        `⏸️ URL (ID: ${urlId}) の監視を一時停止しました。`,
      );
    } catch (error) {
      this.logger.error(`Failed to pause URL:`, error);
      let errorMessage = '不明なエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      await this.telegramService.sendMessage(
        chatId,
        `監視の一時停止に失敗しました: ${errorMessage}`,
      );
    }
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
        '使用方法: /resume <URLのID>\n/list でIDを確認してください。',
      );
      return;
    }

    const urlId = args[0]; // IDは文字列として扱う

    try {
      this.urlService.resumeUrl(user.telegramId, urlId);
      await this.telegramService.sendMessage(
        chatId,
        `▶️ URL (ID: ${urlId}) の監視を再開しました。`,
      );
    } catch (error) {
      this.logger.error(`Failed to resume URL:`, error);
      let errorMessage = '不明なエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      await this.telegramService.sendMessage(
        chatId,
        `監視の再開に失敗しました: ${errorMessage}`,
      );
    }
  }

  /**
   * /status コマンドハンドラー
   */
  private async handleStatusCommand(chatId: number, user: User) {
    const urls = await this.urlService.findByUserId(user.telegramId);
    const activeUrls = urls.filter((u) => u.isActive);
    const pausedUrls = urls.filter((u) => !u.isActive);

    const notificationStatus = user.settings
      ? user.settings.notifications.enabled
      : false;

    const message = [
      '📊 監視状況:',
      '',
      `👤 ユーザー: ${user.displayName}`,
      `📅 登録日: ${user.createdAt.toLocaleDateString('ja-JP')}`,
      `🔍 監視中URL: ${String(activeUrls.length)}件`,
      `⏸️ 一時停止中: ${String(pausedUrls.length)}件`,
      `🔔 通知設定: ${notificationStatus ? 'ON' : 'OFF'}`,
      '',
      `合計登録数: ${String(urls.length)}件`,
    ].join('\n');

    await this.telegramService.sendMessage(chatId, message);
  }

  /**
   * /help コマンドハンドラー
   */
  private async handleHelpCommand(chatId: number) {
    const message = [
      '📚 コマンド一覧:',
      '',
      '/start - ボットを開始',
      '/add <URL> [名前] - 監視URLを追加',
      '/list - 登録URL一覧を表示',
      '/remove <URLのID> - URLを削除',
      '/pause <URLのID> - 監視を一時停止',
      '/resume <URLのID> - 監視を再開',
      '/status - 監視状況を確認',
      '/help - このヘルプを表示',
      '',
      '❓ 使い方:',
      '1. /add でURLを登録',
      '2. 新着物件があれば自動通知',
      '3. /list で登録状況を確認',
      '',
      'お困りの場合は @sokubutsu_support までご連絡ください。',
    ].join('\n');

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
