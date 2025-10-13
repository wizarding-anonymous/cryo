// Моки для HTTP клиентов внешних сервисов

export const createUserServiceClientMock = () => {
  // Отслеживаем созданных пользователей
  const createdUsers = new Map<string, any>();
  
  return {
    findByEmail: jest.fn().mockImplementation(async (email: string) => {
      // Проверяем созданных пользователей
      if (createdUsers.has(email)) {
        return createdUsers.get(email);
      }
      
      // Симулируем существующего пользователя для тестов дубликатов
      if (email === 'existing@example.com') {
        return {
          id: 'user-123',
          name: 'Existing User',
          email: email,
          isActive: true,
          password: 'hashed_existingpassword_10',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      // Симулируем недоступность сервиса для определенных email
      if (email.includes('unavailable')) {
        throw new Error('User Service unavailable');
      }
      
      return null; // User not found
    }),
  
    findById: jest.fn().mockImplementation(async (id: string) => {
      // Возвращаем пользователя для любого ID, который начинается с 'user-'
      if (id && id.startsWith('user-')) {
        // Для определенных тестов возвращаем неактивного пользователя
        const isInactive = id.includes('inactive') || id === 'user-inactive';
        
        return {
          id: id,
          name: 'Test User',
          email: 'test@example.com',
          isActive: !isInactive,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    }),
  
    createUser: jest.fn().mockImplementation(async (userData: any) => {
      // Симулируем создание пользователя
      if (userData.email === 'existing@example.com') {
        throw new Error('Email already exists');
      }
      
      // Симулируем недоступность сервиса
      if (userData.email.includes('unavailable')) {
        throw new Error('User Service unavailable');
      }
      
      const newUser = {
        id: `user-${Date.now()}`,
        name: userData.name,
        email: userData.email,
        password: userData.password,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Сохраняем созданного пользователя
      createdUsers.set(userData.email, newUser);
      
      return newUser;
    }),
  
    updateUser: jest.fn().mockResolvedValue(undefined),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    deactivateUser: jest.fn().mockResolvedValue(undefined),
    checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
    
    // Методы для управления кэшем и статистикой
    clearCache: jest.fn(),
    getCacheStats: jest.fn().mockReturnValue({
      size: 0,
      timeout: 300000,
      hits: 0,
      misses: 0,
    }),
  };
};

export const createSecurityServiceClientMock = () => ({
  logSecurityEvent: jest.fn().mockResolvedValue({
    success: true,
    eventId: `event-${Date.now()}`,
  }),
  
  checkSuspiciousActivity: jest.fn().mockImplementation(async (_userId: string, ipAddress: string) => {
    // Симулируем подозрительную активность для определенных IP
    if (ipAddress === '192.168.1.100') {
      return true;
    }
    return false;
  }),
  
  reportFailedLogin: jest.fn().mockResolvedValue(undefined),
  reportSuccessfulLogin: jest.fn().mockResolvedValue(undefined),
  logTokenRefresh: jest.fn().mockResolvedValue({
    success: true,
    eventId: `token-refresh-${Date.now()}`,
  }),
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
  
  // Методы для управления очередью и статистикой
  clearQueue: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueSize: 0,
    processedEvents: 0,
    failedEvents: 0,
    circuitBreakerState: 'CLOSED',
    circuitBreakerStats: {
      failures: 0,
      successes: 0,
      state: 'CLOSED',
    },
  }),
});

export const createNotificationServiceClientMock = () => ({
  sendWelcomeNotification: jest.fn().mockImplementation(async (_request: any) => {
    return {
      success: true,
      notificationId: `notif-${Date.now()}`,
      message: 'Welcome notification queued successfully',
    };
  }),
  
  sendLoginNotification: jest.fn().mockResolvedValue({
    success: true,
    notificationId: `login-notif-${Date.now()}`,
  }),
  
  sendLoginAlert: jest.fn().mockImplementation(async (_userId: string, _email: string, _ipAddress: string, _userAgent: string, _location?: string) => {
    return {
      success: true,
      notificationId: `alert-${Date.now()}`,
      alertType: 'suspicious_login',
    };
  }),
  
  sendSecurityAlert: jest.fn().mockResolvedValue({
    success: true,
    notificationId: `security-alert-${Date.now()}`,
  }),
  
  sendPasswordResetNotification: jest.fn().mockResolvedValue({
    success: true,
    notificationId: `reset-${Date.now()}`,
  }),
  
  sendMultipleFailedAttemptsAlert: jest.fn().mockResolvedValue({
    success: true,
    notificationId: `failed-attempts-alert-${Date.now()}`,
  }),
  
  checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
  
  // Методы для управления очередью и статистикой
  clearQueue: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueSize: 0,
    sentNotifications: 0,
    failedNotifications: 0,
    circuitBreakerState: 'CLOSED',
    circuitBreakerStats: {
      failures: 0,
      successes: 0,
      state: 'CLOSED',
    },
  }),
});

// Общий мок для HTTP клиентов
export const createHttpClientMock = () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});