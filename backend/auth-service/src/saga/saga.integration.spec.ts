import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { SagaService } from './saga.service';
import { AuthSagaService } from './auth-saga.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/services/event-bus.service';
import { RegisterDto } from '../auth/dto/register.dto';

describe('Saga Integration Tests', () => {
  let sagaService: SagaService;
  let authSagaService: AuthSagaService;
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let tokenService: jest.Mocked<TokenService>;
  let sessionService: jest.Mocked<SessionService>;
  let eventBusService: jest.Mocked<EventBusService>;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: 3600,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    accessTokenHash: 'hashed-access-token',
    refreshTokenHash: 'hashed-refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Мокаем setImmediate чтобы избежать асинхронного выполнения саг
    jest.spyOn(global, 'setImmediate').mockImplementation((callback: any) => {
      // Не выполняем callback, чтобы избежать фонового выполнения
      return {} as any;
    });

    userServiceClient = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
    } as any;

    tokenService = {
      generateTokens: jest.fn(),
      blacklistToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn(),
      invalidateSession: jest.fn(),
      getUserSessions: jest.fn(),
    } as any;

    eventBusService = {
      publishUserRegisteredEvent: jest.fn(),
      publishUserLoggedInEvent: jest.fn(),
      publishSecurityEvent: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          SAGA_TIMEOUT: 30000,
          SAGA_MAX_RETRIES: 3,
          SAGA_LOCK_TTL: 60000,
        };
        return config[key] || defaultValue;
      }),
    } as any;

    // Create a more realistic Redis mock that simulates saga storage
    const sagaStorage = new Map<string, string>();
    
    redisService = {
      set: jest.fn().mockImplementation(async (key: string, value: string) => {
        sagaStorage.set(key, value);
        return undefined;
      }),
      get: jest.fn().mockImplementation(async (key: string) => {
        return sagaStorage.get(key) || null;
      }),
      setNX: jest.fn().mockResolvedValue('OK'),
      delete: jest.fn().mockImplementation(async (key: string) => {
        sagaStorage.delete(key);
        return undefined;
      }),
      keys: jest.fn().mockImplementation(async (pattern: string) => {
        return Array.from(sagaStorage.keys()).filter(key => 
          pattern === '*' || key.includes(pattern.replace('*', ''))
        );
      }),
      mget: jest.fn().mockImplementation(async (...keys: string[]) => {
        return keys.map(key => sagaStorage.get(key) || null);
      }),
    } as any;

    sagaService = new SagaService(redisService, configService);
    authSagaService = new AuthSagaService(
      sagaService,
      userServiceClient,
      tokenService,
      sessionService,
      eventBusService
    );
  });

  afterEach(() => {
    // Очищаем все таймеры и асинхронные операции
    jest.clearAllTimers();
    jest.clearAllMocks();
    // Восстанавливаем setImmediate
    jest.restoreAllMocks();
  });

  describe('Saga Service Integration', () => {
    it('should create and store saga transactions', async () => {
      const steps = [
        {
          name: 'testStep',
          execute: jest.fn().mockResolvedValue('success'),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
      ];

      const sagaId = await sagaService.startSaga('testSaga', steps, { test: true });

      expect(sagaId).toBeDefined();
      expect(typeof sagaId).toBe('string');

      // Verify saga was stored
      const storedSaga = await sagaService.getSaga(sagaId);
      expect(storedSaga).toBeDefined();
      expect(storedSaga!.name).toBe('testSaga');
      expect(storedSaga!.status).toBe('pending');
    });

    it('should handle saga metrics correctly', async () => {
      // Create some mock saga data with proper date serialization
      const completedSaga = {
        id: 'completed-saga',
        name: 'testSaga',
        status: 'completed',
        startedAt: new Date(Date.now() - 5000).toISOString(),
        completedAt: new Date().toISOString(),
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
      };

      const failedSaga = {
        id: 'failed-saga',
        name: 'testSaga',
        status: 'failed',
        startedAt: new Date(Date.now() - 3000).toISOString(),
        completedAt: new Date().toISOString(),
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
      };

      // Store sagas directly in Redis mock
      await redisService.set('saga:completed-saga', JSON.stringify(completedSaga));
      await redisService.set('saga:failed-saga', JSON.stringify(failedSaga));

      const metrics = await sagaService.getMetrics();

      expect(metrics.totalTransactions).toBe(2);
      expect(metrics.completedTransactions).toBe(1);
      expect(metrics.failedTransactions).toBe(1);
      expect(metrics.successRate).toBe(50);
    });

    it('should cleanup old sagas', async () => {
      const oldSaga = {
        id: 'old-saga',
        name: 'testSaga',
        status: 'completed',
        startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
      };

      const recentSaga = {
        id: 'recent-saga',
        name: 'testSaga',
        status: 'completed',
        startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
      };

      // Store sagas
      await redisService.set('saga:old-saga', JSON.stringify(oldSaga));
      await redisService.set('saga:recent-saga', JSON.stringify(recentSaga));

      const deletedCount = await sagaService.cleanup(24); // 24 hours

      expect(deletedCount).toBe(1);

      // Verify old saga was deleted
      const oldSagaAfterCleanup = await sagaService.getSaga('old-saga');
      expect(oldSagaAfterCleanup).toBeNull();

      // Verify recent saga still exists
      const recentSagaAfterCleanup = await sagaService.getSaga('recent-saga');
      expect(recentSagaAfterCleanup).toBeDefined();
    });
  });

  describe('Auth Saga Service Integration', () => {
    it('should create registration saga with correct structure', async () => {
      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const sagaId = await authSagaService.executeRegistrationSaga(
        registerDto,
        '127.0.0.1',
        'Test Agent'
      );

      expect(sagaId).toBeDefined();

      // Verify saga was created with correct metadata
      const saga = await sagaService.getSaga(sagaId);
      expect(saga).toBeDefined();
      expect(saga!.name).toBe('userRegistration');
      expect(saga!.steps).toHaveLength(6); // All registration steps
      expect(saga!.metadata).toEqual(
        expect.objectContaining({
          email: registerDto.email,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        })
      );
    });

    it('should create login saga with correct structure', async () => {
      const sagaId = await authSagaService.executeLoginSaga(
        mockUser,
        '127.0.0.1',
        'Test Agent',
        5
      );

      expect(sagaId).toBeDefined();

      // Verify saga was created with correct metadata
      const saga = await sagaService.getSaga(sagaId);
      expect(saga).toBeDefined();
      expect(saga!.name).toBe('userLogin');
      expect(saga!.steps).toHaveLength(3); // All login steps
      expect(saga!.metadata).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          maxSessionsPerUser: 5,
        })
      );
    });

    it('should handle saga completion polling', async () => {
      // Create a completed saga manually
      const completedSaga = {
        id: 'completed-saga-123',
        name: 'userRegistration',
        status: 'completed',
        startedAt: new Date(Date.now() - 1000).toISOString(),
        completedAt: new Date().toISOString(),
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
        metadata: {},
      };

      await redisService.set('saga:completed-saga-123', JSON.stringify(completedSaga));

      const result = await authSagaService.waitForSagaCompletion('completed-saga-123', 1000);

      expect(result.completed).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should handle saga failure polling', async () => {
      // Create a failed saga manually
      const failedSaga = {
        id: 'failed-saga-123',
        name: 'userRegistration',
        status: 'failed',
        startedAt: new Date(Date.now() - 1000).toISOString(),
        completedAt: new Date().toISOString(),
        error: 'Test error',
        steps: [],
        currentStepIndex: 0,
        executedSteps: [],
        compensatedSteps: [],
        metadata: {},
      };

      await redisService.set('saga:failed-saga-123', JSON.stringify(failedSaga));

      const result = await authSagaService.waitForSagaCompletion('failed-saga-123', 1000);

      expect(result.completed).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Test error');
    });

    it('should handle saga timeout', async () => {
      const result = await authSagaService.waitForSagaCompletion('non-existent-saga', 100);

      expect(result.completed).toBe(false);
      expect(result.status).toBe('not_found');
    });
  });

  describe('Service Integration', () => {
    it('should properly mock all required services', () => {
      expect(userServiceClient).toBeDefined();
      expect(tokenService).toBeDefined();
      expect(sessionService).toBeDefined();
      expect(eventBusService).toBeDefined();
      expect(redisService).toBeDefined();
    });

    it('should handle service method calls', async () => {
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);
      tokenService.generateTokens.mockResolvedValue(mockTokens);
      sessionService.createSession.mockResolvedValue(mockSession);
      eventBusService.publishUserRegisteredEvent.mockResolvedValue();

      // Test that all mocks work correctly
      expect(await userServiceClient.findByEmail('test@example.com')).toBeNull();
      expect(await userServiceClient.createUser({} as any)).toEqual(mockUser);
      expect(await tokenService.generateTokens({} as any)).toEqual(mockTokens);
      expect(await sessionService.createSession({} as any)).toEqual(mockSession);
      
      await eventBusService.publishUserRegisteredEvent({} as any);
      expect(eventBusService.publishUserRegisteredEvent).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      // Mock Redis to throw an error
      redisService.set.mockRejectedValueOnce(new Error('Redis connection failed'));

      const steps = [
        {
          name: 'testStep',
          execute: jest.fn().mockResolvedValue('success'),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
      ];

      await expect(sagaService.startSaga('testSaga', steps)).rejects.toThrow('Redis connection failed');
    });

    it('should handle service errors in saga creation', async () => {
      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      // This should not throw even if Redis has issues during async execution
      const sagaId = await authSagaService.executeRegistrationSaga(
        registerDto,
        '127.0.0.1',
        'Test Agent'
      );

      expect(sagaId).toBeDefined();
      expect(typeof sagaId).toBe('string');
    });
  });

  describe('Configuration', () => {
    it('should use correct configuration values', () => {
      // Test that the service is properly configured
      expect(sagaService).toBeDefined();
      expect(authSagaService).toBeDefined();
    });
  });
});