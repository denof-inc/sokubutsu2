import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { StealthModule } from './stealth/stealth.module';
import { CacheModule } from './cache/cache.module';
import { StrategiesModule } from './strategies/strategies.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { AutoRecoveryService } from './recovery/auto-recovery.service';

@Module({
  imports: [StealthModule, CacheModule, StrategiesModule, OrchestrationModule],
  providers: [
    ScrapingService,
    AutoRecoveryService,
  ],
  exports: [
    ScrapingService,
    StealthModule,
    CacheModule,
    StrategiesModule,
    OrchestrationModule,
  ],
})
export class ScrapingModule {}
