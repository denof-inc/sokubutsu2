import { Module } from '@nestjs/common';
import { UltraFastScrapingOrchestrator } from '../orchestrator/ultra-fast-orchestrator';
import { ParallelScrapingOrchestrator } from './parallel-scraping-orchestrator';
import { BrowserPoolManager } from '../browser-pool/browser-pool-manager';

@Module({
  providers: [
    UltraFastScrapingOrchestrator,
    ParallelScrapingOrchestrator,
    BrowserPoolManager,
  ],
  exports: [
    UltraFastScrapingOrchestrator,
    ParallelScrapingOrchestrator,
    BrowserPoolManager,
  ],
})
export class OrchestrationModule {}