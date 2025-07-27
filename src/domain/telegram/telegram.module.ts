import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { AuthModule } from '../../core/auth/auth.module';
import { UrlModule } from '../url/url.module';

@Module({
  imports: [AuthModule, UrlModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
