import { Module, Global } from '@nestjs/common';
import { ResourceMonitorService } from './resource-monitor.service';
import { ProcessManagerService } from './process-manager.service';
import { ComprehensiveMonitorService } from './comprehensive-monitor.service';
import { AlertManagerService } from './alert-manager.service';
import { MetricsCollectorService } from './metrics-collector.service';
import { NotificationModule } from '../notification/notification.module';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [
    ResourceMonitorService,
    ProcessManagerService,
    ComprehensiveMonitorService,
    AlertManagerService,
    MetricsCollectorService,
  ],
  exports: [
    ResourceMonitorService,
    ProcessManagerService,
    ComprehensiveMonitorService,
    MetricsCollectorService,
  ],
})
export class MonitoringModule {}
