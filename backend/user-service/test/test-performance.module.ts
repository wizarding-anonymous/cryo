import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { User } from '../src/user/entities/user.entity';
import { UserModule } from '../src/user/user.module';
import { ProfileModule } from '../src/profile/profile.module';
import { TestHealthModule } from './test-health.module';
import { AppPrometheusModule } from '../src/common/prometheus/prometheus.module';
import { TestPerformanceConfigModule } from './test-performance-config.module';
import { TestLoggingModule } from './test-logging.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { RedisModule } from '../src/common/redis/redis.module';
import { EncryptionModule } from '../src/common/encryption/encryption.module';
import { IntegrationsModule } from '../src/integrations/integrations.module';
import { MetricsModule } from '../src/common/metrics/metrics.module';

@Module({
  imports: [
    // --- Test Config Module ---
    TestPerformanceConfigModule,

    // --- Throttler Module with high limits for tests ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10000, // Very high limit for performance tests
      },
    ]),

    // --- TypeORM Module with PostgreSQL for performance tests ---
    TypeOrmModule.forRootAsync({
      imports: [TestPerformanceConfigModule],
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'user_service_test',
        entities: [User],
        synchronize: true,
        logging: false,
        dropSchema: false, // Don't drop schema for performance tests
      }),
    }),
    
    // --- TypeORM Feature Module to provide repositories ---
    TypeOrmModule.forFeature([User]),

    // --- Cache Module (In-Memory for performance tests) ---
    CacheModule.register({
      isGlobal: true,
    }),

    // --- Custom Modules ---
    TestLoggingModule,
    UserModule,
    ProfileModule,
    TestHealthModule,
    AppPrometheusModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    // Mock external dependencies for performance tests
    {
      provide: 'CacheService',
      useValue: {
        getUser: jest.fn().mockResolvedValue(null),
        setUser: jest.fn().mockResolvedValue(undefined),
        invalidateUser: jest.fn().mockResolvedValue(undefined),
        getUsersBatch: jest.fn().mockResolvedValue(new Map()),
        setUsersBatch: jest.fn().mockResolvedValue(undefined),
        getCacheStats: jest.fn().mockResolvedValue({}),
      },
    },
    {
      provide: 'SecurityClient',
      useValue: {
        logSecurityEvent: jest.fn().mockResolvedValue(undefined),
        reportSuspiciousActivity: jest.fn().mockResolvedValue(undefined),
        validateApiKey: jest.fn().mockResolvedValue(true),
      },
    },
    {
      provide: 'IntegrationService',
      useValue: {
        notifyUserCreated: jest.fn().mockResolvedValue(undefined),
        notifyUserUpdated: jest.fn().mockResolvedValue(undefined),
        notifyUserDeleted: jest.fn().mockResolvedValue(undefined),
        publishUserEvent: jest.fn().mockResolvedValue(undefined),
      },
    },
  ],
})
export class TestPerformanceModule { }