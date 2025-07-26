import { Module, Global } from '@nestjs/common';
import { BotProtectionService } from './bot-protection.service';

@Global()
@Module({
  providers: [BotProtectionService],
  exports: [BotProtectionService],
})
export class BotProtectionModule {}