import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntegrationMonitoringService } from '../application/services/integration-monitoring.service';
import { IntegrationMonitoringController } from '../infrastructure/http/controllers/integration-monitoring.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [IntegrationMonitoringService],
  controllers: [IntegrationMonitoringController],
  exports: [IntegrationMonitoringService],
})
export class IntegrationMonitoringModule {}