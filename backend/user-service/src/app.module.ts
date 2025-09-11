import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { AppConfigService } from './config/config.service';

@Module({
  imports: [
    // --- Global Config Module ---
    AppConfigModule,

    // --- Throttler Module for Rate Limiting ---
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => [
        {
          ttl: configService.throttleConfig.ttl,
          limit: configService.throttleConfig.limit,
        },
      ],
    }),

    // --- TypeORM Module (PostgreSQL) ---
    // Asynchronously configures the database connection using variables from AppConfigService.
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const dbConfig = configService.databaseConfig;
        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          autoLoadEntities: true, // Automatically load all entities registered with forFeature
          synchronize: false, // This is now handled by migrations
          extra: {
            max: dbConfig.maxConnections,
            connectionTimeoutMillis: dbConfig.connectionTimeout,
          },
        };
      },
    }),

    // --- Cache Module (Redis) ---
    // Asynchronously configures the Redis cache connection for cache-manager v5.
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [AppConfigService],
      useFactory: async (configService: AppConfigService) => {
        // The redisStore function is passed as the store factory.
        // Options like host and port are passed at the top level and are used by NestJS to instantiate the store.
        const { redisStore } = await import('cache-manager-redis-store');
        const redisConfig = configService.redisConfig;
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          retryDelayOnFailover: redisConfig.retryDelay,
          maxRetriesPerRequest: redisConfig.maxRetries,
        };
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
