import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { RepositoryModule } from '../repositories/repository.module';
import { RedisModule } from '../common/redis/redis.module';
import { MetricsModule } from '../common/metrics/metrics.module';

@Module({
  imports: [
    RepositoryModule,
    RedisModule, // Add Redis module for distributed locking
    MetricsModule, // Add metrics module for race condition monitoring
    ScheduleModule.forRoot(), // Enable cron jobs for session cleanup
  ],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}