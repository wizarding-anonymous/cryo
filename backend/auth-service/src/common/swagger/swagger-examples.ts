/**
 * Swagger/OpenAPI Examples for Auth Service
 * 
 * This file contains example data for API documentation.
 * Since the current version of @nestjs/swagger doesn't support inline examples,
 * these examples can be referenced in the API documentation or used for testing.
 */

export const SwaggerExamples = {
  // Authentication Examples
  auth: {
    register: {
      request: {
        name: 'Иван Петров',
        email: 'ivan.petrov@example.com',
        password: 'SecurePass123!'
      },
      response: {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'ivan.petrov@example.com',
          name: 'Иван Петров',
          lastLoginAt: null,
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        },
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        expires_in: 3600
      }
    },
    login: {
      request: {
        email: 'ivan.petrov@example.com',
        password: 'SecurePass123!'
      },
      response: {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'ivan.petrov@example.com',
          name: 'Иван Петров',
          lastLoginAt: '2024-01-14T08:15:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        },
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        expires_in: 3600
      }
    },
    refresh: {
      request: {
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      response: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_in: 3600
      }
    },
    validate: {
      request: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      response: {
        valid: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'ivan.petrov@example.com',
          name: 'Иван Петров',
          lastLoginAt: '2024-01-15T10:30:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        },
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        expiresAt: 1705317600
      }
    }
  },

  // Session Management Examples
  sessions: {
    list: {
      total: 3,
      active: 2,
      inactive: 1,
      sessions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          isActive: true,
          createdAt: '2024-01-15T10:30:00.000Z',
          expiresAt: '2024-01-16T10:30:00.000Z',
          lastAccessedAt: '2024-01-15T12:45:00.000Z'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          ipAddress: '10.0.0.50',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          isActive: true,
          createdAt: '2024-01-15T08:15:00.000Z',
          expiresAt: '2024-01-16T08:15:00.000Z',
          lastAccessedAt: '2024-01-15T11:20:00.000Z'
        }
      ]
    },
    stats: {
      totalActiveSessions: 150,
      totalExpiredSessions: 45,
      sessionsPerUser: {
        '550e8400-e29b-41d4-a716-446655440000': 3,
        '550e8400-e29b-41d4-a716-446655440001': 2,
        '550e8400-e29b-41d4-a716-446655440002': 1
      }
    },
    concurrentInfo: {
      withinLimit: {
        currentSessionCount: 3,
        maxAllowedSessions: 5,
        isAtLimit: false,
        canCreateNewSession: true,
        oldestSessionAge: 3600000,
        sessionsUntilLimit: 2
      },
      atLimit: {
        currentSessionCount: 5,
        maxAllowedSessions: 5,
        isAtLimit: true,
        canCreateNewSession: false,
        oldestSessionAge: 7200000,
        sessionsUntilLimit: 0
      }
    }
  },

  // Error Examples
  errors: {
    validation: {
      statusCode: 400,
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/auth/register',
      method: 'POST',
      message: [
        'Пароль должен содержать минимум 8 символов',
        'Пароль должен содержать заглавные буквы',
        'Email имеет некорректный формат'
      ],
      error: 'Bad Request'
    },
    conflict: {
      statusCode: 409,
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/auth/register',
      method: 'POST',
      message: 'Пользователь с таким email уже существует',
      error: 'Conflict'
    },
    unauthorized: {
      statusCode: 401,
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/auth/login',
      method: 'POST',
      message: 'Неверный email или пароль',
      error: 'Unauthorized'
    },
    rateLimit: {
      statusCode: 429,
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/auth/login',
      method: 'POST',
      message: 'Слишком много попыток входа. Попробуйте снова через несколько минут.',
      error: 'Too Many Requests',
      retryAfter: 900
    }
  },

  // Health Check Examples
  health: {
    healthy: {
      status: 'ok',
      info: {
        database: { status: 'up' },
        memory_heap: { status: 'up', info: { used: 45.2, limit: 150 } },
        memory_rss: { status: 'up', info: { used: 78.5, limit: 150 } }
      },
      error: {},
      details: {
        database: { status: 'up' },
        memory_heap: { status: 'up', info: { used: 45.2, limit: 150 } },
        memory_rss: { status: 'up', info: { used: 78.5, limit: 150 } }
      }
    },
    unhealthy: {
      status: 'error',
      info: {
        memory_heap: { status: 'up', info: { used: 45.2, limit: 150 } },
        memory_rss: { status: 'up', info: { used: 78.5, limit: 150 } }
      },
      error: {
        database: { status: 'down', info: { message: 'Connection timeout' } }
      },
      details: {
        database: { status: 'down', info: { message: 'Connection timeout' } },
        memory_heap: { status: 'up', info: { used: 45.2, limit: 150 } },
        memory_rss: { status: 'up', info: { used: 78.5, limit: 150 } }
      }
    },
    database: {
      connected: true,
      responseTime: 45.2,
      migrations: {
        upToDate: true,
        executedMigrations: 5,
        pendingMigrations: 0,
        executedMigrationNames: ['CreateUserTable1640995200000', 'CreateSessionTable1640995300000']
      },
      info: {
        type: 'PostgreSQL',
        version: '15.4',
        database: 'auth_db',
        host: 'localhost:5432',
        activeConnections: 10,
        maxConnections: 20
      },
      timestamp: '2024-01-15T10:30:00.000Z'
    }
  }
};