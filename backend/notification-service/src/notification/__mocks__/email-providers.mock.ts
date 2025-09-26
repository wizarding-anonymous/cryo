/**
 * Mock implementations for Russian email providers
 * Used in testing to simulate email service responses
 */

export class MockMailRuProvider {
  static mockSuccessResponse = {
    status: 200,
    data: {
      message_id: 'mailru-msg-123',
      status: 'sent',
    },
  };

  static mockErrorResponse = {
    status: 400,
    data: {
      error: 'invalid_recipient',
      message: 'Invalid email address',
    },
  };

  static mockRateLimitResponse = {
    status: 429,
    data: {
      error: 'rate_limit_exceeded',
      message: 'Too many requests',
      retry_after: 60,
    },
  };
}

export class MockYandexProvider {
  static mockSuccessResponse = {
    status: 200,
    data: {
      message_id: 'yandex-msg-456',
      result: 'ok',
    },
  };

  static mockErrorResponse = {
    status: 400,
    data: {
      error_code: 'INVALID_EMAIL',
      error_message: 'Некорректный email адрес',
    },
  };

  static mockAuthErrorResponse = {
    status: 401,
    data: {
      error_code: 'INVALID_API_KEY',
      error_message: 'Неверный API ключ',
    },
  };
}

export class MockGenericProvider {
  static mockSuccessResponse = {
    status: 200,
    data: {
      id: 'generic-msg-789',
      status: 'queued',
    },
  };

  static mockErrorResponse = {
    status: 500,
    data: {
      error: 'internal_server_error',
      message: 'Service temporarily unavailable',
    },
  };
}

/**
 * Mock HTTP service responses for different scenarios
 */
export const mockHttpResponses = {
  mailru: {
    success: MockMailRuProvider.mockSuccessResponse,
    error: MockMailRuProvider.mockErrorResponse,
    rateLimit: MockMailRuProvider.mockRateLimitResponse,
  },
  yandex: {
    success: MockYandexProvider.mockSuccessResponse,
    error: MockYandexProvider.mockErrorResponse,
    authError: MockYandexProvider.mockAuthErrorResponse,
  },
  generic: {
    success: MockGenericProvider.mockSuccessResponse,
    error: MockGenericProvider.mockErrorResponse,
  },
};

/**
 * Mock user service responses
 */
export const mockUserServiceResponses = {
  validUser: {
    status: 200,
    data: {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      isActive: true,
    },
  },
  userNotFound: {
    status: 404,
    data: {
      error: 'user_not_found',
      message: 'User not found',
    },
  },
  serviceUnavailable: {
    status: 503,
    data: {
      error: 'service_unavailable',
      message: 'User service is temporarily unavailable',
    },
  },
};