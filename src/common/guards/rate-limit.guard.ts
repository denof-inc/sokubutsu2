import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly requests = new Map<string, RateLimitInfo>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const telegramUser = request.telegramUser;

    if (!telegramUser) {
      return true; // 認証前はスキップ
    }

    const userId = telegramUser.id.toString();
    const now = Date.now();
    const windowMs = 60 * 1000; // 1分
    const maxRequests = 30; // 1分間に30リクエスト

    const userRequests = this.requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      // 新しいウィンドウ
      this.requests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (userRequests.count >= maxRequests) {
      this.logger.warn(`Rate limit exceeded for user ${userId}`);
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    userRequests.count++;
    return true;
  }
}
