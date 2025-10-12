import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyMiddleware } from './idempotency.middleware';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisModule } from '../redis/redis.module';
import { HttpClientModule } from '../http-client/http-client.module';

@Module({
  imports: [RedisModule, HttpClientModule],
  providers: [
    IdempotencyService,
    IdempotencyMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply idempotency middleware to auth routes
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes('auth');
  }
}