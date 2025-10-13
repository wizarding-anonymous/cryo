import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';

// Core auth components
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

// Services
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/services/event-bus.service';
import { RedisService } from '../common/redis/redis.service';

// Test configurations
import { createTestRedisService } from './test-redis.config';

// Mock services for external dependencies
import {
  createUserServiceClientMock,
  createSecurityServiceClientMock,
  createNotificationServiceClientMock,
  createTokenServiceMock,
  createSessionServiceMock,
  createEventBusServiceMock,
  createAuthSagaServiceMock,
  createSagaServiceMock,
  createAsyncOperationsServiceMock,
  createAsyncMetricsServiceMock,
  createWorkerProcessServiceMock,
} from './mocks';

import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { AuthSagaService } from '../saga/auth-saga.service';
import { SagaService } from '../saga/saga.service';
import { AsyncOperationsService } from '../common/async/async-operations.service';
import { AsyncMetricsService } from '../common/async/async-metrics.service';
import { WorkerProcessService } from '../common/async/worker-process.service';

/**
 * Полностью изолированный тестовый модуль для e2e тестов
 * Все зависимости мокированы для стабильности и изоляции
 */
@Module({
  imports: [
    // Конфигурация для тестовой среды
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          // Database configuration (SQLite in memory)
          DATABASE_TYPE: 'sqlite',
          DATABASE_DATABASE: ':memory:',
          DATABASE_SYNCHRONIZE: 'true',
          DATABASE_LOGGING: 'false',
          
          // JWT configuration
          JWT_SECRET: 'test-jwt-secret-key-for-e2e-tests',
          JWT_EXPIRES_IN: '1h',
          JWT_REFRESH_EXPIRES_IN: '7d',
          
          // Redis configuration (mocked)
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'test-password',
          REDIS_URL: 'redis://:test-password@localhost:6379',
          
          // Session configuration
          MAX_SESSIONS_PER_USER: '5',
          SESSION_TIMEOUT: '86400',
          
          // Security configuration
          BCRYPT_ROUNDS: '10',
          PASSWORD_MIN_LENGTH: '8',
          
          // Rate limiting
          THROTTLE_TTL: '60',
          THROTTLE_LIMIT: '10',
          
          // External services (mocked)
          USER_SERVICE_URL: 'http://localhost:3002',
          SECURITY_SERVICE_URL: 'http://localhost:3010',
          NOTIFICATION_SERVICE_URL: 'http://localhost:3007',
          
          // Circuit breaker
          CIRCUIT_BREAKER_TIMEOUT: '3000',
          CIRCUIT_BREAKER_ERROR_THRESHOLD: '50',
          CIRCUIT_BREAKER_RESET_TIMEOUT: '30000',
          
          // Saga pattern
          USE_SAGA_PATTERN: 'false', // Отключаем для простоты тестов
          
          // Test environment flag
          NODE_ENV: 'test',
          IS_E2E_TEST: 'true',
        }),
      ],
    }),

    // Passport module
    PassportModule,

    // JWT configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),

    // HTTP module for external service clients
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: 5000,
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),

    // Throttling configuration
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000, // Convert to milliseconds
            limit: configService.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Core auth providers
    AuthService,
    JwtStrategy,

    // Mock Redis service - полная изоляция от внешнего Redis
    {
      provide: RedisService,
      useValue: createTestRedisService(),
    },

    // Mock core services
    {
      provide: TokenService,
      useValue: createTokenServiceMock(),
    },
    {
      provide: SessionService,
      useValue: createSessionServiceMock(),
    },
    {
      provide: EventBusService,
      useValue: createEventBusServiceMock(),
    },

    // Mock external service clients
    {
      provide: UserServiceClient,
      useValue: createUserServiceClientMock(),
    },
    {
      provide: SecurityServiceClient,
      useValue: createSecurityServiceClientMock(),
    },
    {
      provide: NotificationServiceClient,
      useValue: createNotificationServiceClientMock(),
    },

    // Mock saga services
    {
      provide: AuthSagaService,
      useValue: createAuthSagaServiceMock(),
    },
    {
      provide: SagaService,
      useValue: createSagaServiceMock(),
    },

    // Mock async services
    {
      provide: AsyncOperationsService,
      useValue: createAsyncOperationsServiceMock(),
    },
    {
      provide: AsyncMetricsService,
      useValue: createAsyncMetricsServiceMock(),
    },
    {
      provide: WorkerProcessService,
      useValue: createWorkerProcessServiceMock(),
    },
  ],
  exports: [
    AuthService,
    RedisService,
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
    TokenService,
    SessionService,
  ],
})
export class E2ETestModule {}