import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServiceMonitorService } from './service-monitor.service';
import { MonitoringController } from './monitoring.controller';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    MetricsModule,
  ],
  controllers: [MonitoringController],
  providers: [ServiceMonitorService],
  exports: [ServiceMonitorService],
})
export class MonitoringModule {}
