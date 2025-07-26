import { Module, Global } from '@nestjs/common';
import { BotProtectionService } from './bot-protection.service';
import { BrowserStealthService } from '../scraping/browser-stealth.service';

@Global()
@Module({
  providers: [BotProtectionService, BrowserStealthService],
  exports: [BotProtectionService, BrowserStealthService],
})
export class BotProtectionModule {}