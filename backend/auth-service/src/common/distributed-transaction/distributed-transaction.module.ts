import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DistributedTransactionService } from './distributed-transaction.service';
import { ConsistencySchedulerService } from './consistency-scheduler.service';
import { ConsistencyMetricsService } from './consistency-metrics.service';
import { ConsistencyController } from './consistency.controller';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    RedisModule, 
    DatabaseModule,
    ScheduleModule.forRoot(), // Для поддержки cron jobs
  ],
  providers: [
    DistributedTransactionService,
    ConsistencySchedulerService,
    ConsistencyMetricsService,
  ],
  controllers: [ConsistencyController],
  exports: [
    DistributedTransactionService,
    ConsistencySchedulerService,
    ConsistencyMetricsService,
  ],
})
export class DistributedTransactionModule {}