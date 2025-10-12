// Вспомогательные функции для тестов

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashedPassword123',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUserWithoutPassword = (overrides = {}) => {
  const { password, ...userWithoutPassword } = createMockUser(overrides);
  return userWithoutPassword;
};

export const createMockSession = (overrides = {}) => ({
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
  ...overrides,
});

export const createMockTokens = (overrides = {}) => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  ...overrides,
});

export const createMockLoginAttempt = (overrides = {}) => ({
  id: 'attempt-123',
  email: 'john@example.com',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Agent',
  success: true,
  createdAt: new Date(),
  ...overrides,
});

export const createMockSecurityEvent = (overrides = {}) => ({
  id: 'event-123',
  userId: 'user-123',
  type: 'login',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Agent',
  metadata: {},
  createdAt: new Date(),
  ...overrides,
});

// Утилиты для работы с датами в тестах
export const addHours = (date: Date, hours: number) => 
  new Date(date.getTime() + hours * 60 * 60 * 1000);

export const addDays = (date: Date, days: number) => 
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// Утилиты для проверки вызовов моков
export const expectMockToHaveBeenCalledWith = (mock: jest.Mock, ...args: any[]) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

export const expectMockToHaveBeenCalledTimes = (mock: jest.Mock, times: number) => {
  expect(mock).toHaveBeenCalledTimes(times);
};

// Сброс всех моков
export const resetAllMocks = (...mocks: jest.Mock[]) => {
  mocks.forEach(mock => mock.mockReset());
};