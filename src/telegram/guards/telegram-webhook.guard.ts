import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TelegramWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // 開発環境では検証をスキップ
    if (this.configService.get('NODE_ENV') === 'development') {
      return true;
    }

    const secretToken = this.configService.get<string>('TELEGRAM_SECRET_TOKEN');
    if (!secretToken) {
      this.logger.warn('Telegram secret token not configured');
      return true; // 設定されていない場合は通す
    }

    const telegramSignature = request.headers['x-telegram-bot-api-secret-token'];
    
    if (!telegramSignature) {
      this.logger.warn('Missing Telegram signature header');
      throw new UnauthorizedException('Missing Telegram signature');
    }

    if (telegramSignature !== secretToken) {
      this.logger.warn('Invalid Telegram signature');
      throw new UnauthorizedException('Invalid Telegram signature');
    }

    return true;
  }
}