import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

@Module({
  imports: [
    // --- Throttler Module for Rate Limiting ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    // --- Global Config Module ---
    // Loads environment variables from .env file and makes them available application-wide.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // --- TypeORM Module (PostgreSQL) ---
    // Asynchronously configures the database connection using variables from ConfigService.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: parseInt(configService.get<string>('POSTGRES_PORT'), 10),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        autoLoadEntities: true, // Automatically load all entities registered with forFeature
        synchronize: false, // This is now handled by migrations
      }),
    }),

    // --- Cache Module (Redis) ---
    // Asynchronously configures the Redis cache connection.
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Using dynamic import for cache-manager-redis-store to handle potential CJS/ESM module issues.
        const { redisStore } = await import('cache-manager-redis-store');
        return {
          store: redisStore,
          socket: {
            host: configService.get('REDIS_HOST'),
            port: parseInt(configService.get('REDIS_PORT'), 10),
          },
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
