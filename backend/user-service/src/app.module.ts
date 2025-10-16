import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IntegrationsModule } from './integrations/integrations.module';
import { UserModule } from './user/user.module';
import { ProfileModule } from './profile/profile.module';

import { HealthModule } from './health/health.module';
import { AppPrometheusModule } from './common/prometheus/prometheus.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ErrorMetricsInterceptor } from './common/interceptors/error-metrics.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { CacheModule } from './common/cache/cache.module';
import { LoggingModule } from './common/logging/logging.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { RateLimitModule } from './common/guards/rate-limit.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ConfigFactory } from './config/config.factory';
import { EnvironmentVariables } from './config/env.validation';

@Module({
  imports: [
    // --- Global Config Module ---
    AppConfigModule,

    // --- Database Module (PostgreSQL with TypeORM) ---
    DatabaseModule,

    // --- Redis Module for caching ---
    RedisModule,

    // --- Cache Module for multi-level caching ---
    CacheModule,

    // --- Logging Module for structured logging ---
    LoggingModule,

    // --- Encryption Module for sensitive data ---
    EncryptionModule,

    // --- Rate Limiting Module ---
    RateLimitModule,

    // --- Throttler Module for Rate Limiting ---
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);
        return configFactory.createThrottlerConfig();
      },
    }),

    // --- Custom Modules ---
    IntegrationsModule,
    UserModule,
    ProfileModule,
    HealthModule,
    AppPrometheusModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply the custom RateLimitGuard globally to all routes
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // Keep ThrottlerGuard as fallback
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Apply interceptors globally in order of execution
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorMetricsInterceptor,
    },
    // Apply the GlobalExceptionFilter globally to all routes
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем CorrelationIdMiddleware ко всем маршрутам
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
