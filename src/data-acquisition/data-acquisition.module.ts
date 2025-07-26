import { Module } from '@nestjs/common';
import { HybridStrategyService } from './hybrid-strategy.service';
import { ApiClientService } from './api-client.service';
import { FeedParserService } from './feed-parser.service';
import { ScrapingModule } from '../scraping/scraping.module';

@Module({
  imports: [ScrapingModule],
  providers: [
    HybridStrategyService,
    ApiClientService,
    FeedParserService
  ],
  exports: [HybridStrategyService]
})
export class DataAcquisitionModule {}