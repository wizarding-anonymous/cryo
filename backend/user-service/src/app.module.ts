import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IntegrationsModule } from './integrations/integrations.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { HealthModule } from './health/health.module';
import { AppPrometheusModule } from './common/prometheus/prometheus.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { ConfigFactory } from './config/config.factory';
import { EnvironmentVariables } from './config/env.validation';

@Module({
  imports: [
    // --- Global Config Module ---
    AppConfigModule,

    // --- Database Module (PostgreSQL with TypeORM) ---
    DatabaseModule,

    // --- Redis Module for JWT blacklisting and caching ---
    RedisModule,

    // --- Throttler Module for Rate Limiting ---
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);
        return configFactory.createThrottlerConfig();
      },
    }),

    // --- Cache Module (Memory Store) ---
    // Use memory store for cache-manager to avoid Redis compatibility issues
    // Redis is still used directly for JWT blacklist and other operations
    CacheModule.registerAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);
        return configFactory.createCacheConfig();
      },
    }),

    // --- Custom Modules ---
    IntegrationsModule,
    UserModule,
    AuthModule,
    ProfileModule,
    HealthModule,
    AppPrometheusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply the ThrottlerGuard globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
