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

    // --- Cache Module (Memory Store) ---
    // Use memory store for cache-manager to avoid Redis compatibility issues
    // Redis is still used directly for JWT blacklist and other operations
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache
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
