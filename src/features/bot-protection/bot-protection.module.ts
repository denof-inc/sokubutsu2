import { Module, Global } from '@nestjs/common';
import { BotProtectionService } from './bot-protection.service';
import { ScrapingModule } from '../scraping/scraping.module';

@Global()
@Module({
  imports: [ScrapingModule],
  providers: [BotProtectionService],
  exports: [BotProtectionService],
})
export class BotProtectionModule {}