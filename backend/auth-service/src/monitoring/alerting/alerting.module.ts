import { Module } from '@nestjs/common';
import { AlertingService } from './alerting.service';
import { AlertRulesService } from './alert-rules.service';
import { AlertManagerService } from './alert-manager.service';
import { PrometheusModule } from '../prometheus/prometheus.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [
    PrometheusModule,
    LoggingModule,
  ],
  providers: [
    AlertingService,
    AlertRulesService,
    AlertManagerService,
  ],
  exports: [
    AlertingService,
    AlertRulesService,
    AlertManagerService,
  ],
})
export class AlertingModule {}