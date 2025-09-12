import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { winstonLogger } from './config/logger.config';
import { CacheConfig } from './config/cache.config';
import { JwtConfig } from './config/jwt.config';
import { ThrottlerConfig } from './config/throttler.config';
import { envValidationSchema } from './config/env.validation';

// Modules
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './common/auth/auth.module';
import { AlsModule } from './common/als/als.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      envFilePath: ['.env.local', '.env'],
    }),

    // Logging
    WinstonModule.forRoot(winstonLogger),

    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    // Cache
    CacheModule.registerAsync({
      useClass: CacheConfig,
      isGlobal: true,
    }),

    // JWT
    JwtModule.registerAsync({
      useClass: JwtConfig,
      global: true,
    }),

    // Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // HTTP Client
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useClass: ThrottlerConfig,
    }),

    // Feature modules
    AuthModule,
    AlsModule,
    MetricsModule,
    OrderModule,
    PaymentModule,
    HealthModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}