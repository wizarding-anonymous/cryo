import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsService } from '../application/services/metrics.service';
import { MetricsController } from '../infrastructure/http/controllers/metrics.controller';

@Module({
  imports: [TerminusModule],
  providers: [MetricsService],
  controllers: [MetricsController],
})
export class MonitoringModule {}
