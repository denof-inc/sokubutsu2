import { Module } from '@nestjs/common';
import { ProvenGoogleAccessStrategy } from './proven-google-access.strategy';
import { GoogleAccessStrategy } from './google-access.strategy';

@Module({
  providers: [ProvenGoogleAccessStrategy, GoogleAccessStrategy],
  exports: [ProvenGoogleAccessStrategy, GoogleAccessStrategy],
})
export class StrategiesModule {}