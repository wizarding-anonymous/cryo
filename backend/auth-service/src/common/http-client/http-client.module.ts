import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { UserServiceClient } from './user-service.client';
import { SecurityServiceClient } from './security-service.client';
import { NotificationServiceClient } from './notification-service.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000, // 5 second default timeout
      maxRedirects: 3,
    }),
    CircuitBreakerModule,
  ],
  providers: [
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
  ],
  exports: [
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
  ],
})
export class HttpClientModule {}