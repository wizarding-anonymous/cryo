import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

import { winstonLogger } from './config/logger.config';
import { JwtConfig } from './config/jwt.config';
import { ThrottlerConfig } from './config/throttler.config';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app.config';

// Modules
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './common/auth/auth.module';
import { AlsModule } from './common/als/als.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration (Global)
    ConfigModule,

    // Logging
    WinstonModule.forRoot(winstonLogger),

    // JWT
    JwtModule.registerAsync({
      useClass: JwtConfig,
      global: true,
    }),

    // Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // HTTP Client with dynamic configuration
    HttpModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        timeout: configService.external.timeoutMs,
        maxRedirects: 5,
        retries: configService.external.retryAttempts,
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useClass: ThrottlerConfig,
    }),

    // Core modules
    DatabaseModule,
    AuthModule,
    AlsModule,
    MetricsModule,

    // Feature modules
    OrderModule,
    PaymentModule,
    HealthModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
