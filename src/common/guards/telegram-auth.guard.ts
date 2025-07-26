import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from '../../core/auth/auth.service';
import { TelegramUpdate } from '../interfaces';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const update: TelegramUpdate = request.body;

    // Telegramメッセージの検証
    if (!update || !update.message || !update.message.from) {
      this.logger.warn('Invalid Telegram update structure');
      throw new UnauthorizedException('Invalid request');
    }

    const telegramId = update.message.from.id.toString();
    const telegramUser = update.message.from;

    try {
      // ユーザー認証
      const user = await this.authService.getUser(telegramId);
      
      if (!user) {
        // 新規ユーザーの場合、/startコマンド以外は拒否
        const isStartCommand = update.message.text === '/start';
        if (!isStartCommand) {
          this.logger.warn(`Unregistered user ${telegramId} tried to access without /start`);
          throw new UnauthorizedException('Please use /start command first');
        }
        
        // /startコマンドの場合は認証をスキップ（ハンドラーで処理）
        request.telegramUser = telegramUser;
        request.isNewUser = true;
        return true;
      }

      // アクティブチェック
      if (!user.isActive) {
        this.logger.warn(`Inactive user ${telegramId} tried to access`);
        throw new UnauthorizedException('Your account is inactive');
      }

      // 最終アクティブ時刻を更新（非同期で実行）
      this.authService.getUser(telegramId).then(user => {
        if (user) {
          // バックグラウンドで更新
          this.authService.authenticateTelegramUser(telegramUser).catch(err => {
            this.logger.error(`Failed to update last active for ${telegramId}:`, err);
          });
        }
      });

      // リクエストにユーザー情報を追加
      request.user = user;
      request.telegramUser = telegramUser;
      request.isNewUser = false;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error(`Authentication error for ${telegramId}:`, error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}