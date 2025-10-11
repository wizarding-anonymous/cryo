import { Module } from '@nestjs/common';
import { RaceConditionMetricsService } from './race-condition-metrics.service';

@Module({
  providers: [RaceConditionMetricsService],
  exports: [RaceConditionMetricsService],
})
export class MetricsModule {}