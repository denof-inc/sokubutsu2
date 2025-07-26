import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { TelegramUser } from './interfaces/telegram-user.interface';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Telegramユーザーの認証・登録処理
   */
  async authenticateTelegramUser(telegramUser: TelegramUser): Promise<User> {
    const telegramId = telegramUser.id.toString();
    
    // 既存ユーザーチェック
    let user = await this.usersService.findByTelegramId(telegramId);

    if (user) {
      // 既存ユーザーの場合、最終アクティブ時刻と情報を更新
      this.logger.debug(`Existing user found: ${telegramId}`);
      
      const updateData: any = {
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
      
      const createUserDto: CreateUserDto = {
        telegramId,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        languageCode: telegramUser.language_code,
        isActive: true,
        settings: {
          notifications: {
            enabled: true,
            silent: false,
          },
        },
      };

      user = await this.usersService.create(createUserDto);
    }

    return user;
  }

  /**
   * /startコマンド処理
   */
  async handleStartCommand(telegramUser: TelegramUser): Promise<{
    user: User;
    isNewUser: boolean;
    welcomeMessage: string;
  }> {
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
   * ユーザーがアクティブかチェック
   */
  async validateUser(telegramId: string): Promise<boolean> {
    const user = await this.usersService.findByTelegramId(telegramId);
    return user?.isActive ?? false;
  }

  /**
   * ユーザー情報を取得（認証済み前提）
   */
  async getUser(telegramId: string): Promise<User | null> {
    return this.usersService.findByTelegramId(telegramId);
  }
}