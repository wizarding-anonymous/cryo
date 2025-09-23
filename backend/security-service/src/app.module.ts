import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SecurityModule } from './modules/security/security.module';
import { LogsModule } from './modules/logs/logs.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { WinstonModule } from 'nest-winston';
import { winstonLogger } from './config/logger.config';
import { IpBlockMiddleware } from './common/middleware/ip-block.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SecurityLoggingInterceptor } from './common/interceptors/security-logging.interceptor';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './modules/health/health.controller';
import { MetricsModule } from './common/metrics/metrics.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], validationSchema: envValidationSchema }),
    WinstonModule.forRoot(winstonLogger),
    JwtModule.register({ global: true }),
    DatabaseModule,
    RedisModule,
    MetricsModule,
    KafkaModule,
    SecurityModule,
    LogsModule,
    AlertsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: SecurityLoggingInterceptor },
    LoggingMiddleware,
    IpBlockMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware, IpBlockMiddleware).forRoutes('*');
  }
}

