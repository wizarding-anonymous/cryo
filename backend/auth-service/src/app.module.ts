import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TokenModule } from './token/token.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { HttpClientModule } from './common/http-client/http-client.module';
import { FallbackModule } from './common/fallback/fallback.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { SessionModule } from './session/session.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { AsyncModule } from './common/async/async.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'auth-strict',
        ttl: 900000, // 15 minutes
        limit: 5, // 5 authentication attempts per 15 minutes
      },
    ]),
    AuthModule,
    TokenModule,
    RedisModule,
    HttpClientModule,
    FallbackModule,
    HealthModule,
    EventsModule,
    SessionModule,
    IdempotencyModule,
    AsyncModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule { }