import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../../domain/users/users.service';
import { User, UserSettings } from '../../domain/users/entities/user.entity';
import { TelegramUser, UserUpdateData } from '../../common/interfaces';
import { CreateUserDto } from '../../domain/users/dto/create-user.dto';
import {
  TelegramAuthException,
  UserRegistrationException,
  InvalidTelegramDataException,
} from '../../common/exceptions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Telegramユーザーの認証・登録処理
   */
  async authenticateTelegramUser(telegramUser: TelegramUser): Promise<User> {
    try {
      // 入力検証
      this.validateTelegramUser(telegramUser);

      const telegramId = telegramUser.id.toString();

      // 既存ユーザーチェック
      let user = await this.usersService.findByTelegramId(telegramId);

      if (user) {
        // 既存ユーザーの場合、最終アクティブ時刻と情報を更新
        this.logger.debug(`Existing user found: ${telegramId}`);

        const updateData: UserUpdateData = {
          lastActiveAt: new Date(),
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          languageCode: telegramUser.language_code,
        };

        // アクティブでないユーザーは再有効化
        if (!user.isActive) {
          updateData.isActive = true;
          this.logger.log(`Reactivating user: ${telegramId}`);
        }

        user = await this.usersService.update(telegramId, updateData);
      } else {
        // 新規ユーザー作成
        this.logger.log(`Creating new user: ${telegramId}`);

        const defaultSettings: UserSettings = {
          notifications: {
            enabled: true,
            silent: false,
          },
          language: telegramUser.language_code || 'ja',
        };

        const createUserDto: CreateUserDto = {
          telegramId,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          languageCode: telegramUser.language_code,
          isActive: true,
          settings: defaultSettings,
        };

        user = await this.usersService.create(createUserDto);
      }

      return user;
    } catch (error) {
      this.logger.error(
        `Authentication failed for Telegram user ${telegramUser?.id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof InvalidTelegramDataException ||
        error instanceof UserRegistrationException
      ) {
        throw error;
      }

      throw new TelegramAuthException('Authentication failed');
    }
  }

  /**
   * /startコマンド処理
   */
  async handleStartCommand(telegramUser: TelegramUser): Promise<{
    user: User;
    isNewUser: boolean;
    welcomeMessage: string;
  }> {
    try {
      const telegramId = telegramUser.id.toString();
      const existingUser = await this.usersService.exists(telegramId);

      // ユーザー認証・登録
      const user = await this.authenticateTelegramUser(telegramUser);

      // ウェルカムメッセージ生成
      const welcomeMessage = this.generateWelcomeMessage(user, !existingUser);

      return {
        user,
        isNewUser: !existingUser,
        welcomeMessage,
      };
    } catch (error) {
      this.logger.error(
        `Start command failed for user ${telegramUser?.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ウェルカムメッセージ生成
   */
  private generateWelcomeMessage(user: User, isNewUser: boolean): string {
    const greeting = isNewUser ? 'はじめまして' : 'おかえりなさい';

    const message = `
${greeting}、${user.fullName}さん！🏠

${isNewUser ? 'ソクブツへようこそ！' : 'またお会いできて嬉しいです！'}

📋 使用可能なコマンド:
/add <URL> - 監視URLを追加
/list - 登録URL一覧を表示
/remove <番号> - URLを削除
/pause <番号> - 監視を一時停止
/resume <番号> - 監視を再開
/status - 監視状況を確認
/help - ヘルプを表示

まずは /add コマンドで監視したい物件URLを登録してください！
    `.trim();

    return message;
  }

  /**
   * Telegramユーザーデータの検証
   */
  private validateTelegramUser(telegramUser: TelegramUser): void {
    if (!telegramUser) {
      throw new InvalidTelegramDataException('Telegram user data is required');
    }

    if (!telegramUser.id) {
      throw new InvalidTelegramDataException('Telegram user ID is required');
    }

    if (
      !telegramUser.first_name ||
      telegramUser.first_name.trim().length === 0
    ) {
      throw new InvalidTelegramDataException(
        'Telegram user first name is required',
      );
    }

    // 名前の長さ制限
    if (telegramUser.first_name.length > 255) {
      throw new InvalidTelegramDataException('First name is too long');
    }

    if (telegramUser.last_name && telegramUser.last_name.length > 255) {
      throw new InvalidTelegramDataException('Last name is too long');
    }

    if (telegramUser.username && telegramUser.username.length > 255) {
      throw new InvalidTelegramDataException('Username is too long');
    }
  }

  /**
   * ユーザーがアクティブかチェック
   */
  async validateUser(telegramId: string): Promise<boolean> {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      return user?.isActive ?? false;
    } catch (error) {
      this.logger.error(
        `User validation failed for ${telegramId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * ユーザー情報を取得（認証済み前提）
   */
  async getUser(telegramId: string): Promise<User | null> {
    try {
      return await this.usersService.findByTelegramId(telegramId);
    } catch (error) {
      this.logger.error(`Failed to get user ${telegramId}: ${error.message}`);
      return null;
    }
  }
}
