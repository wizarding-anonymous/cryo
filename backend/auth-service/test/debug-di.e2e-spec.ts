import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

// Import mocks
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
  createJwtServiceMock,
  createConfigServiceMock,
} from '../src/test/mocks';

import { createTestRedisService } from '../src/test/test-redis.config';

// Services
import { TokenService } from '../src/token/token.service';
import { SessionService } from '../src/session/session.service';
import { EventBusService } from '../src/events/services/event-bus.service';
import { RedisService } from '../src/common/redis/redis.service';
import { UserServiceClient } from '../src/common/http-client/user-service.client';
import { SecurityServiceClient } from '../src/common/http-client/security-service.client';
import { NotificationServiceClient } from '../src/common/http-client/notification-service.client';
import { AuthSagaService } from '../src/saga/auth-saga.service';
import { SagaService } from '../src/saga/saga.service';
import { AsyncOperationsService } from '../src/common/async/async-operations.service';
import { AsyncMetricsService } from '../src/common/async/async-metrics.service';
import { WorkerProcessService } from '../src/common/async/worker-process.service';

describe('Debug DI Container', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-key-for-e2e-tests',
              JWT_EXPIRES_IN: '1h',
              JWT_REFRESH_EXPIRES_IN: '7d',
              MAX_SESSIONS_PER_USER: '5',
              SESSION_TIMEOUT: '86400',
              BCRYPT_ROUNDS: '10',
              PASSWORD_MIN_LENGTH: '8',
              THROTTLE_TTL: '60',
              THROTTLE_LIMIT: '10',
              USE_SAGA_PATTERN: 'false',
              NODE_ENV: 'test',
              IS_E2E_TEST: 'true',
            }),
          ],
        }),
        PassportModule,
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
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: JwtService,
          useValue: createJwtServiceMock(),
        },
        {
          provide: ConfigService,
          useValue: createConfigServiceMock(),
        },
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
        {
          provide: RedisService,
          useValue: createTestRedisService(),
        },
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
        {
          provide: AuthSagaService,
          useValue: createAuthSagaServiceMock(),
        },
        {
          provide: SagaService,
          useValue: createSagaServiceMock(),
        },
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
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should list all available providers', () => {
    console.log('=== Available providers in DI container ===');
    
    // Try to get each service and log the result
    const services = [
      'UserServiceClient',
      'SecurityServiceClient', 
      'NotificationServiceClient',
      'AuthService',
      'TokenService',
      'SessionService',
      'JwtService',
      'ConfigService'
    ];

    services.forEach(serviceName => {
      try {
        const service = moduleFixture.get(serviceName);
        console.log(`✓ ${serviceName}: Found`);
      } catch (error) {
        console.log(`✗ ${serviceName}: NOT FOUND - ${error.message}`);
      }
    });

    // Try to get by class
    const serviceClasses = [
      UserServiceClient,
      SecurityServiceClient,
      NotificationServiceClient,
      AuthService,
      TokenService,
      SessionService,
      JwtService,
      ConfigService
    ];

    console.log('\n=== Trying to get by class ===');
    serviceClasses.forEach(ServiceClass => {
      try {
        const service = moduleFixture.get(ServiceClass);
        console.log(`✓ ${ServiceClass.name}: Found`);
      } catch (error) {
        console.log(`✗ ${ServiceClass.name}: NOT FOUND - ${error.message}`);
      }
    });
  });

  it('should be able to get UserServiceClient', () => {
    expect(() => {
      const userServiceClient = moduleFixture.get(UserServiceClient);
      expect(userServiceClient).toBeDefined();
    }).not.toThrow();
  });
});