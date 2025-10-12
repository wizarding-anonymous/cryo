import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Основные сервисы
export const createJwtServiceMock = () => ({
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
  decode: jest.fn(),
});

export const createConfigServiceMock = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    const config = {
      MAX_SESSIONS_PER_USER: 5,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
    };
    return config[key];
  }),
});

// Метрики и мониторинг
export const createRaceConditionMetricsServiceMock = () => ({
  recordLockAcquisition: jest.fn(),
  recordLockRelease: jest.fn(),
  recordLockTimeout: jest.fn(),
  recordConcurrentAttempts: jest.fn(),
  recordConcurrentSessionCreation: jest.fn(),
  getLockMetrics: jest.fn().mockResolvedValue({
    totalLocks: 0,
    activeLocks: 0,
    averageLockTime: 0,
  }),
});

export const createConsistencyMetricsServiceMock = () => ({
  recordTransaction: jest.fn(),
  recordRollback: jest.fn(),
  recordInconsistency: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue({
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
  }),
});

// Распределенные транзакции
export const createDistributedTransactionServiceMock = () => ({
  beginTransaction: jest.fn().mockResolvedValue('tx-123'),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  isTransactionActive: jest.fn().mockResolvedValue(false),
});

// Redis и кэширование
export const createRedisServiceMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
});

export const createRedisLockServiceMock = () => ({
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(true),
  isLocked: jest.fn().mockResolvedValue(false),
  getLockTTL: jest.fn().mockResolvedValue(30000),
});

export const createCacheServiceMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
});

// Токены и сессии
export const createTokenServiceMock = () => ({
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  }),
  hashToken: jest.fn().mockReturnValue('hashed-token'),
  verifyToken: jest.fn().mockResolvedValue(true),
  blacklistToken: jest.fn(),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
});

export const createSessionServiceMock = () => ({
  createSession: jest.fn().mockResolvedValue({
    id: 'session-123',
    userId: 'user-123',
    accessTokenHash: 'hashed-access-token',
    refreshTokenHash: 'hashed-refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
  }),
  findByUserId: jest.fn(),
  findById: jest.fn(),
  updateSession: jest.fn(),
  deactivateSession: jest.fn(),
  enforceSessionLimit: jest.fn().mockResolvedValue(0),
  createSessionWithLimit: jest.fn(),
});

// События
export const createEventBusServiceMock = () => ({
  publishUserRegisteredEvent: jest.fn(),
  publishUserLoggedInEvent: jest.fn(),
  publishUserLoggedOutEvent: jest.fn(),
  publishSecurityEvent: jest.fn(),
  publishTokenRefreshedEvent: jest.fn(),
});

// Saga и асинхронные операции
export const createAuthSagaServiceMock = () => ({
  executeRegistrationSaga: jest.fn(),
  executeLoginSaga: jest.fn(),
  executeLogoutSaga: jest.fn(),
  rollbackRegistration: jest.fn(),
  rollbackLogin: jest.fn(),
});

export const createSagaServiceMock = () => ({
  executeSaga: jest.fn(),
  rollbackSaga: jest.fn(),
  getSagaStatus: jest.fn(),
});

export const createAsyncOperationsServiceMock = () => ({
  executeAsync: jest.fn(),
  getOperationStatus: jest.fn(),
  cancelOperation: jest.fn(),
});

export const createAsyncMetricsServiceMock = () => ({
  recordOperation: jest.fn(),
  getMetrics: jest.fn(),
});

export const createWorkerProcessServiceMock = () => ({
  processTask: jest.fn(),
  getWorkerStatus: jest.fn(),
});

// Идемпотентность
export const createIdempotencyServiceMock = () => ({
  checkIdempotency: jest.fn().mockResolvedValue(null),
  storeResult: jest.fn(),
  getResult: jest.fn(),
});

// Circuit Breaker
export const createCircuitBreakerServiceMock = () => ({
  execute: jest.fn(),
  getState: jest.fn().mockReturnValue('CLOSED'),
  getStats: jest.fn(),
});

// Fallback
export const createFallbackServiceMock = () => ({
  executeFallback: jest.fn(),
  isEnabled: jest.fn().mockReturnValue(true),
});