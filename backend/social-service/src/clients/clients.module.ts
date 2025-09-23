import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserServiceClient } from './user.service.client';
import { NotificationServiceClient } from './notification.service.client';
import { AchievementServiceClient } from './achievement.service.client';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ExternalServicesHealthService } from './external-services-health.service';
import { CacheConfigModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    CacheConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get<number>('HTTP_TIMEOUT', 10000),
        maxRedirects: configService.get<number>('HTTP_MAX_REDIRECTS', 3),
        retries: configService.get<number>('HTTP_RETRIES', 3),
        retryDelay: (retryCount: number) => {
          const baseDelay = configService.get<number>('HTTP_RETRY_DELAY', 200);
          return Math.min(baseDelay * Math.pow(2, retryCount), 5000);
        },
        // Add default headers for service-to-service communication
        headers: {
          'User-Agent': 'social-service/1.0.0',
          'X-Service-Name': 'social-service',
        },
        // Connection pooling for better performance
        maxSockets: configService.get<number>('HTTP_MAX_SOCKETS', 100),
        maxFreeSockets: configService.get<number>('HTTP_MAX_FREE_SOCKETS', 10),
        keepAlive: true,
        keepAliveMsecs: 30000,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    UserServiceClient,
    NotificationServiceClient,
    AchievementServiceClient,
    CircuitBreakerService,
    ExternalServicesHealthService,
  ],
  exports: [
    UserServiceClient,
    NotificationServiceClient,
    AchievementServiceClient,
    CircuitBreakerService,
    ExternalServicesHealthService,
  ],
})
export class ClientsModule {}
