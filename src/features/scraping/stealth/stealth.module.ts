import { Module } from '@nestjs/common';
import { BrowserStealthService } from '../browser-stealth.service';
import { AdvancedStealthService } from './advanced-stealth.service';

@Module({
  providers: [BrowserStealthService, AdvancedStealthService],
  exports: [BrowserStealthService, AdvancedStealthService],
})
export class StealthModule {}