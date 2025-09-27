import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

/**
 * Настройка Swagger/OpenAPI документации для API Gateway
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Cryo Gaming Platform API Gateway')
    .setDescription(
      `
      API Gateway для российской игровой платформы Cryo.
      
      Обеспечивает единую точку входа для всех микросервисов с поддержкой:
      - JWT аутентификации
      - Rate limiting
      - Маршрутизации запросов
      - Стандартизации ответов
      - Мониторинга и метрик
      
      ## Аутентификация
      Большинство endpoints требуют JWT токен в заголовке Authorization:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Rate Limiting
      API применяет ограничения по количеству запросов:
      - 100 запросов в минуту для аутентифицированных пользователей
      - 20 запросов в минуту для неаутентифицированных запросов
      
      ## Маршрутизация
      Gateway проксирует запросы к следующим сервисам:
      - User Service: /api/users/*
      - Game Catalog Service: /api/games/*
      - Payment Service: /api/payments/*
      - Library Service: /api/library/*
      - Social Service: /api/social/*
      - Review Service: /api/reviews/*
      - Achievement Service: /api/achievements/*
      - Notification Service: /api/notifications/*
      - Download Service: /api/downloads/*
      - Security Service: /api/security/*
      
      ## Коды ошибок
      
      ### 4xx Client Errors
      - **400 Bad Request** - Некорректные параметры запроса
      - **401 Unauthorized** - Отсутствует или недействительный JWT токен
      - **403 Forbidden** - Недостаточно прав доступа
      - **404 Not Found** - Ресурс не найден
      - **429 Too Many Requests** - Превышен лимит запросов
      
      ### 5xx Server Errors
      - **500 Internal Server Error** - Внутренняя ошибка Gateway
      - **502 Bad Gateway** - Ошибка upstream сервиса
      - **503 Service Unavailable** - Целевой сервис недоступен
      - **504 Gateway Timeout** - Таймаут запроса к сервису
      
      ## Примеры использования
      
      ### Получение списка игр (публичный endpoint)
      \`\`\`bash
      curl -X GET "http://localhost:3000/api/games" \\
        -H "Accept: application/json"
      \`\`\`
      
      ### Получение профиля пользователя (требует аутентификации)
      \`\`\`bash
      curl -X GET "http://localhost:3000/api/users/profile" \\
        -H "Accept: application/json" \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN"
      \`\`\`
      
      ### Покупка игры (требует аутентификации)
      \`\`\`bash
      curl -X POST "http://localhost:3000/api/payments/purchase" \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
        -d '{"gameId": "game-123", "paymentMethod": "card"}'
      \`\`\`
    `,
    )
    .setVersion('1.0.0')
    .setContact('Cryo Development Team', 'https://cryo.ru', 'dev@cryo.ru')
    .setLicense('Proprietary', 'https://cryo.ru/license')
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api-dev.cryo.ru', 'Development environment')
    .addServer('https://api.cryo.ru', 'Production environment')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag(
      'Proxy',
      'Основные endpoints для проксирования запросов к микросервисам',
    )
    .addTag('Health', 'Endpoints для проверки состояния системы')
    .addTag('Metrics', 'Prometheus метрики для мониторинга')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Cryo API Gateway Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .topbar-wrapper .link { content: url('https://cryo.ru/logo.png'); width: 120px; height: auto; }
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .info .title { color: #16537e; }
      .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 4px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      requestInterceptor: (req: any) => {
        // Add request ID for tracing
        req.headers['X-Request-ID'] =
          `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return req;
      },
    },
  });
}

/**
 * Swagger теги для организации документации
 */
export const SWAGGER_TAGS = {
  PROXY: 'Proxy',
  HEALTH: 'Health',
  METRICS: 'Metrics',
} as const;

/**
 * Общие Swagger ответы для переиспользования
 */
export const COMMON_RESPONSES = {
  UNAUTHORIZED: {
    status: 401,
    description: 'Не авторизован - требуется JWT токен',
  },
  FORBIDDEN: {
    status: 403,
    description: 'Недостаточно прав доступа',
  },
  NOT_FOUND: {
    status: 404,
    description: 'Ресурс не найден',
  },
  RATE_LIMITED: {
    status: 429,
    description: 'Превышен лимит запросов',
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    description: 'Целевой сервис недоступен',
  },
  GATEWAY_TIMEOUT: {
    status: 504,
    description: 'Таймаут запроса к сервису',
  },
} as const;
