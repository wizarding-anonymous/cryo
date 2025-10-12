// Моки для HTTP клиентов внешних сервисов

export const createUserServiceClientMock = () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  updateLastLogin: jest.fn(),
  deactivateUser: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
});

export const createSecurityServiceClientMock = () => ({
  logSecurityEvent: jest.fn(),
  checkSuspiciousActivity: jest.fn().mockResolvedValue(false),
  reportFailedLogin: jest.fn(),
  reportSuccessfulLogin: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
});

export const createNotificationServiceClientMock = () => ({
  sendWelcomeNotification: jest.fn(),
  sendLoginNotification: jest.fn(),
  sendSecurityAlert: jest.fn(),
  sendPasswordResetNotification: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
});

// Общий мок для HTTP клиентов
export const createHttpClientMock = () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});