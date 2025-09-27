import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AchievementModule } from './achievement/achievement.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { SecurityModule } from './security/security.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { GracefulShutdownService } from './graceful-shutdown.service';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';
import configuration from './config/configuration';
import { createLoggerConfig } from './config/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
    }),
    WinstonModule.forRootAsync({
      useFactory: () => {
        const nodeEnv = process.env.NODE_ENV || 'development';
        const logLevel = process.env.LOG_LEVEL || 'info';
        const logFormat = process.env.LOG_FORMAT || 'simple';
        return createLoggerConfig(nodeEnv, logLevel, logFormat);
      },
    }),
    SecurityModule,
    DatabaseModule,
    AchievementModule,
    HealthModule,
    MetricsModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    GracefulShutdownService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
