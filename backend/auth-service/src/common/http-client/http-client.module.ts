import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { CacheModule } from '../cache/cache.module';
import { FallbackModule } from '../fallback/fallback.module';
import { UserServiceClient } from './user-service.client';
import { SecurityServiceClient } from './security-service.client';
import { NotificationServiceClient } from './notification-service.client';
import { UserCacheService } from '../cache/user-cache.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000, // 5 second default timeout
      maxRedirects: 3,
    }),
    CircuitBreakerModule,
    CacheModule,
    FallbackModule,
  ],
  providers: [
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
    UserCacheService,
  ],
  exports: [
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
    UserCacheService,
  ],
})
export class HttpClientModule {}