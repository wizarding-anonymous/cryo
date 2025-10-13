import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Основные сервисы
export const createJwtServiceMock = () => ({
  signAsync: jest.fn().mockImplementation(async (payload, options) => {
    const baseToken = `jwt-token-${payload.sub}-${payload.email}`;
    if (options?.expiresIn === '7d') {
      return `${baseToken}-refresh`;
    }
    return `${baseToken}-access`;
  }),
  verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-123', email: 'test@example.com' }),
  verify: jest.fn().mockImplementation((token) => {
    // Простая проверка токена для тестов
    
    // Проверяем blacklisted токены
    if (globalTestState.blacklistedTokens.has(token)) {
      throw new Error('Token is blacklisted');
    }
    
    if (token && (
      token.startsWith('jwt-token-') ||
      token.startsWith('new-access-token') ||
      token.startsWith('mock-access-token') ||
      token.includes('access-token') ||
      token.includes('refresh-token')
    )) {
      // Проверяем, не является ли токен неправильным
      if (token === 'invalid.jwt.token' || token === 'malformed-token' || token === 'this.is.not.a.valid.jwt.token') {
        throw new Error('Invalid token');
      }

      if (token.startsWith('jwt-token-')) {
        // Формат: jwt-token-{userId}-{email}-{type}
        const tokenWithoutPrefix = token.replace('jwt-token-', '');
        const lastDashIndex = tokenWithoutPrefix.lastIndexOf('-');
        if (lastDashIndex > 0) {
          const withoutType = tokenWithoutPrefix.substring(0, lastDashIndex);
          // Ищем разделитель между userId и email - userId всегда заканчивается цифрой, email начинается с буквы
          const match = withoutType.match(/^(user-\d+)-(.+)$/);
          if (match) {
            const userId = match[1];
            const email = match[2];
            return { sub: userId, email: email };
          }
        }
      }
      // Для всех остальных токенов возвращаем стандартные данные
      return { sub: 'user-123', email: 'test@example.com' };
    }
    throw new Error('Invalid token');
  }),
  decode: jest.fn().mockReturnValue({ sub: 'user-123', email: 'test@example.com' }),
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

// Глобальное состояние для тестов
const globalTestState = {
  blacklistedTokens: new Set<string>(),
  usedRefreshTokens: new Set<string>(),
};

// Функция для очистки состояния между тестами
export const clearTestState = () => {
  globalTestState.blacklistedTokens.clear();
  globalTestState.usedRefreshTokens.clear();
};

// Функция для добавления токена в blacklist (для тестов)
export const addTokenToBlacklistForTest = (token: string) => {
  globalTestState.blacklistedTokens.add(token);
};

// Токены и сессии
export const createTokenServiceMock = () => {
  return {
    generateTokens: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    }),
    hashToken: jest.fn().mockReturnValue('hashed-token'),
    verifyToken: jest.fn().mockResolvedValue(true),
    blacklistToken: jest.fn().mockImplementation(async (token: string) => {
      globalTestState.blacklistedTokens.add(token);
    }),
    isTokenBlacklisted: jest.fn().mockImplementation(async (token: string) => {
      return globalTestState.blacklistedTokens.has(token);
    }),
    validateRefreshToken: jest.fn().mockImplementation(async (token: string) => {
      if (globalTestState.usedRefreshTokens.has(token) || globalTestState.blacklistedTokens.has(token)) {
        throw new Error('Token has been used or blacklisted');
      }
      return {
        valid: true,
        payload: { sub: 'user-123', email: 'test@example.com' },
      };
    }),
    refreshTokenWithRotation: jest.fn().mockImplementation(async (oldToken: string) => {
      // Помечаем старый токен как использованный
      globalTestState.usedRefreshTokens.add(oldToken);
      globalTestState.blacklistedTokens.add(oldToken);

      return {
        accessToken: `new-access-token-${Date.now()}`,
        refreshToken: `new-refresh-token-${Date.now()}`,
        expiresIn: 3600,
      };
    }),
    blacklistAllUserTokens: jest.fn().mockResolvedValue(undefined),
    removeFromBlacklist: jest.fn().mockImplementation(async (token: string) => {
      globalTestState.blacklistedTokens.delete(token);
    }),
    areAllUserTokensInvalidated: jest.fn().mockResolvedValue(false),
  };
};

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
  createSessionWithLimit: jest.fn().mockResolvedValue({
    session: {
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
    },
    removedSessionsCount: 0,
  }),
  getSessionByAccessToken: jest.fn().mockResolvedValue({
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
  invalidateSession: jest.fn().mockResolvedValue(undefined),
});

// События
export const createEventBusServiceMock = () => ({
  publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
  publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
  publishUserLoggedOutEvent: jest.fn().mockResolvedValue(undefined),
  publishSecurityEvent: jest.fn().mockImplementation(() => ({
    catch: jest.fn().mockResolvedValue(undefined)
  })),
  publishTokenRefreshedEvent: jest.fn().mockResolvedValue(undefined),
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
  executeCriticalPath: jest.fn().mockImplementation(async (operation) => {
    // Выполняем операцию напрямую для тестов
    return await operation();
  }),
});

export const createAsyncMetricsServiceMock = () => ({
  recordOperation: jest.fn(),
  getMetrics: jest.fn(),
  recordAuthFlowMetric: jest.fn().mockResolvedValue(undefined),
});

export const createWorkerProcessServiceMock = () => ({
  processTask: jest.fn(),
  getWorkerStatus: jest.fn(),
  executeInWorker: jest.fn().mockImplementation(async (operation) => {
    // Выполняем операцию напрямую для тестов
    if (typeof operation === 'function') {
      return await operation();
    }
    return operation;
  }),
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