import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { IntegrationsModule } from '../src/integrations/integrations.module';
import { UserModule } from '../src/user/user.module';
import { ProfileModule } from '../src/profile/profile.module';
import { TestHealthModule } from './test-health.module';
import { AppPrometheusModule } from '../src/common/prometheus/prometheus.module';
import { LoggingModule } from '../src/common/logging/logging.module';

@Module({
  imports: [
    // --- Config Module with E2E environment ---
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.e2e', '.env.test', '.env'],
      expandVariables: true,
    }),

    // --- Throttler Module with high limits for tests ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10000, // Very high limit for tests
      },
    ]),

    // --- TypeORM Module (Real PostgreSQL in Docker) ---
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: parseInt(configService.get<string>('POSTGRES_PORT'), 10),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: false, // Use migrations instead of sync
        dropSchema: false, // Don't drop schema
        cache: {
          type: 'redis',
          options: {
            host: configService.get<string>('REDIS_HOST'),
            port: parseInt(configService.get<string>('REDIS_PORT'), 10),
            password: configService.get<string>('REDIS_PASSWORD'),
          },
        },
        logging: false, // Disable logging in tests
        extra: {
          // Optimize connection pool for tests
          max: 10,
          min: 2,
          acquireTimeoutMillis: 10000,
          idleTimeoutMillis: 10000,
        },
      }),
    }),

    // --- Cache Module (Real Redis in Docker) ---
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: 'redis',
        host: configService.get<string>('REDIS_HOST'),
        port: parseInt(configService.get<string>('REDIS_PORT'), 10),
        password: configService.get<string>('REDIS_PASSWORD'),
        ttl: 300, // 5 minutes default TTL
      }),
    }),

    // --- Application Modules ---
    LoggingModule,
    IntegrationsModule,
    UserModule,
    ProfileModule,
    TestHealthModule,
    AppPrometheusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class IntegrationAppModule {}