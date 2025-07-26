import { Module, Global } from '@nestjs/common';
import { ResourceMonitorService } from './resource-monitor.service';
import { ProcessManagerService } from './process-manager.service';

@Global()
@Module({
  providers: [ResourceMonitorService, ProcessManagerService],
  exports: [ResourceMonitorService, ProcessManagerService],
})
export class MonitoringModule {}