import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LocalSecurityLoggerService } from './local-security-logger.service';
import { LocalNotificationQueueService } from './local-notification-queue.service';
import { ServiceAvailabilityMonitorService } from './service-availability-monitor.service';
import { FallbackMonitoringController } from './fallback-monitoring.controller';
import { SecurityEvent } from '../../entities/security-event.entity';
import { RedisModule } from '../redis/redis.module';

/**
 * Fallback module for graceful degradation when external services are unavailable
 * Task 17.3: Реализовать graceful degradation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
    ConfigModule,
    RedisModule,
  ],
  controllers: [
    FallbackMonitoringController,
  ],
  providers: [
    LocalSecurityLoggerService,
    LocalNotificationQueueService,
    ServiceAvailabilityMonitorService,
  ],
  exports: [
    LocalSecurityLoggerService,
    LocalNotificationQueueService,
    ServiceAvailabilityMonitorService,
  ],
})
export class FallbackModule {}