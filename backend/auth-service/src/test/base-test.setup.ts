import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  createJwtServiceMock,
  createConfigServiceMock,
  createRaceConditionMetricsServiceMock,
  createConsistencyMetricsServiceMock,
  createDistributedTransactionServiceMock,
  createRedisServiceMock,
  createRedisLockServiceMock,
  createCacheServiceMock,
  createTokenServiceMock,
  createSessionServiceMock,
  createEventBusServiceMock,
  createAuthSagaServiceMock,
  createSagaServiceMock,
  createAsyncOperationsServiceMock,
  createAsyncMetricsServiceMock,
  createWorkerProcessServiceMock,
  createIdempotencyServiceMock,
  createCircuitBreakerServiceMock,
  createFallbackServiceMock,
  createUserServiceClientMock,
  createSecurityServiceClientMock,
  createNotificationServiceClientMock,
  createSessionRepositoryMock,
  createTokenBlacklistRepositoryMock,
  createLoginAttemptRepositoryMock,
  createSecurityEventRepositoryMock,
  createAuthDatabaseServiceMock,
  createDatabaseServiceMock,
  createDatabaseOperationsServiceMock,
} from './mocks';

// Импорты сервисов
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/services/event-bus.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { RedisService } from '../common/redis/redis.service';
import { RedisLockService } from '../common/redis/redis-lock.service';
import { CacheService } from '../common/cache/cache.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { DatabaseService } from '../database/database.service';
import { DatabaseOperationsService } from '../database/database-operations.service';
import { SessionRepository } from '../repositories/session.repository';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import { LoginAttemptRepository } from '../repositories/login-attempt.repository';
import { SecurityEventRepository } from '../repositories/security-event.repository';

// Типы для отсутствующих сервисов
interface RaceConditionMetricsService {
  recordLockAcquisition: jest.Mock;
  recordLockRelease: jest.Mock;
  recordLockTimeout: jest.Mock;
  recordConcurrentAttempts: jest.Mock;
  recordConcurrentSessionCreation: jest.Mock;
  getLockMetrics: jest.Mock;
}

interface ConsistencyMetricsService {
  recordTransaction: jest.Mock;
  recordRollback: jest.Mock;
  recordInconsistency: jest.Mock;
  getMetrics: jest.Mock;
}

interface DistributedTransactionService {
  beginTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  isTransactionActive: jest.Mock;
}

interface AuthSagaService {
  executeRegistrationSaga: jest.Mock;
  executeLoginSaga: jest.Mock;
  executeLogoutSaga: jest.Mock;
  rollbackRegistration: jest.Mock;
  rollbackLogin: jest.Mock;
}

interface SagaService {
  executeSaga: jest.Mock;
  rollbackSaga: jest.Mock;
  getSagaStatus: jest.Mock;
}

interface AsyncOperationsService {
  executeAsync: jest.Mock;
  getOperationStatus: jest.Mock;
  cancelOperation: jest.Mock;
}

interface AsyncMetricsService {
  recordOperation: jest.Mock;
  getMetrics: jest.Mock;
}

interface WorkerProcessService {
  processTask: jest.Mock;
  getWorkerStatus: jest.Mock;
}

interface IdempotencyService {
  checkIdempotency: jest.Mock;
  storeResult: jest.Mock;
  getResult: jest.Mock;
}

interface CircuitBreakerService {
  execute: jest.Mock;
  getState: jest.Mock;
  getStats: jest.Mock;
}

interface FallbackService {
  executeFallback: jest.Mock;
  isEnabled: jest.Mock;
}

/**
 * Базовая конфигурация для unit тестов
 * Предоставляет все необходимые моки для изоляции тестируемых компонентов
 */
export class BaseTestSetup {
  static createBasicProviders() {
    return [
      // Основные сервисы NestJS
      {
        provide: JwtService,
        useValue: createJwtServiceMock(),
      },
      {
        provide: ConfigService,
        useValue: createConfigServiceMock(),
      },
      
      // Метрики и мониторинг
      {
        provide: 'RaceConditionMetricsService',
        useValue: createRaceConditionMetricsServiceMock(),
      },
      {
        provide: 'ConsistencyMetricsService',
        useValue: createConsistencyMetricsServiceMock(),
      },
      
      // Распределенные транзакции
      {
        provide: 'DistributedTransactionService',
        useValue: createDistributedTransactionServiceMock(),
      },
      
      // Redis и кэширование
      {
        provide: RedisService,
        useValue: createRedisServiceMock(),
      },
      {
        provide: RedisLockService,
        useValue: createRedisLockServiceMock(),
      },
      {
        provide: CacheService,
        useValue: createCacheServiceMock(),
      },
      
      // Токены и сессии
      {
        provide: TokenService,
        useValue: createTokenServiceMock(),
      },
      {
        provide: SessionService,
        useValue: createSessionServiceMock(),
      },
      
      // События
      {
        provide: EventBusService,
        useValue: createEventBusServiceMock(),
      },
      
      // Saga и асинхронные операции
      {
        provide: 'AuthSagaService',
        useValue: createAuthSagaServiceMock(),
      },
      {
        provide: 'SagaService',
        useValue: createSagaServiceMock(),
      },
      {
        provide: 'AsyncOperationsService',
        useValue: createAsyncOperationsServiceMock(),
      },
      {
        provide: 'AsyncMetricsService',
        useValue: createAsyncMetricsServiceMock(),
      },
      {
        provide: 'WorkerProcessService',
        useValue: createWorkerProcessServiceMock(),
      },
      
      // Идемпотентность и отказоустойчивость
      {
        provide: 'IdempotencyService',
        useValue: createIdempotencyServiceMock(),
      },
      {
        provide: 'CircuitBreakerService',
        useValue: createCircuitBreakerServiceMock(),
      },
      {
        provide: 'FallbackService',
        useValue: createFallbackServiceMock(),
      },
      
      // HTTP клиенты
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
      
      // Репозитории
      {
        provide: SessionRepository,
        useValue: createSessionRepositoryMock(),
      },
      {
        provide: TokenBlacklistRepository,
        useValue: createTokenBlacklistRepositoryMock(),
      },
      {
        provide: LoginAttemptRepository,
        useValue: createLoginAttemptRepositoryMock(),
      },
      {
        provide: SecurityEventRepository,
        useValue: createSecurityEventRepositoryMock(),
      },
      
      // Базы данных
      {
        provide: AuthDatabaseService,
        useValue: createAuthDatabaseServiceMock(),
      },
      {
        provide: DatabaseService,
        useValue: createDatabaseServiceMock(),
      },
      {
        provide: DatabaseOperationsService,
        useValue: createDatabaseOperationsServiceMock(),
      },
    ];
  }

  /**
   * Создает тестовый модуль с базовыми провайдерами и дополнительными
   */
  static async createTestingModule(
    providers: any[] = [],
    imports: any[] = []
  ): Promise<TestingModule> {
    return Test.createTestingModule({
      imports,
      providers: [
        ...BaseTestSetup.createBasicProviders(),
        ...providers,
      ],
    }).compile();
  }

  /**
   * Создает тестовый модуль для конкретного сервиса
   */
  static async createServiceTestingModule<T>(
    ServiceClass: new (...args: any[]) => T,
    additionalProviders: any[] = []
  ): Promise<{ module: TestingModule; service: T }> {
    const module = await BaseTestSetup.createTestingModule([
      ServiceClass,
      ...additionalProviders,
    ]);

    const service = module.get<T>(ServiceClass);
    return { module, service };
  }
}

// Экспорт типов для использования в тестах
export type {
  RaceConditionMetricsService,
  ConsistencyMetricsService,
  DistributedTransactionService,
  AuthSagaService,
  SagaService,
  AsyncOperationsService,
  AsyncMetricsService,
  WorkerProcessService,
  IdempotencyService,
  CircuitBreakerService,
  FallbackService,
};