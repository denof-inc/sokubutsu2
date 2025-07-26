import { Module } from '@nestjs/common';
import { IntelligentCacheService } from './intelligent-cache.service';

@Module({
  providers: [IntelligentCacheService],
  exports: [IntelligentCacheService],
})
export class CacheModule {}
