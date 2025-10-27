import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createWinstonConfig } from './common/logging/winston.config';
import { Reflector } from '@nestjs/core';

async function bootstrap() {
  // Create Winston configuration based on environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel =
    process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug');
  const logFormat =
    (process.env.LOG_FORMAT as 'json' | 'simple') ||
    (nodeEnv === 'production' ? 'json' : 'simple');
  const serviceName = process.env.SERVICE_NAME || 'user-service';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

  const winstonConfig = createWinstonConfig({
    level: logLevel,
    format: logFormat,
    nodeEnv,
    serviceName,
    serviceVersion,
  });

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    bodyParser: true,
  });

  // Configure body size limits for large batch operations
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  // GlobalExceptionFilter теперь применяется через APP_FILTER в AppModule
  // для правильной инжекции зависимостей

  // Apply global interceptors
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)), // For @Exclude decorator
    new ResponseInterceptor(),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove non-whitelisted properties
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted values are provided
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // --- Swagger API Documentation ---
  const config = new DocumentBuilder()
    .setTitle('User Service API v2.0 - Рефакторинг')
    .setDescription(
      `
      # User Service API - Высокопроизводительный микросервис управления пользователями
      
      После успешного рефакторинга и выделения Auth Service, User Service оптимизирован для управления пользовательскими данными и профилями в микросервисной архитектуре российской игровой платформы.
      
      ## 🚀 Ключевые возможности
      - **Высокопроизводительные batch операции** - до 5000 записей за запрос
      - **Многоуровневое кэширование** с Redis интеграцией и namespace стратегией
      - **Специализированные внутренние API** для каждого микросервиса
      - **Event-driven интеграция** с публикацией событий изменений
      - **Комплексная безопасность** с шифрованием данных и аудитом операций
      - **Продвинутый мониторинг** через Prometheus метрики и health checks
      
      ## 🏗️ Архитектура интеграции
      User Service интегрируется с:
      - **Auth Service** - аутентификация и управление сессиями
      - **Game Catalog Service** - персонализация игрового каталога
      - **Payment Service** - обработка платежей и биллинговая информация
      - **Library Service** - синхронизация игровых предпочтений
      - **Social Service** - социальные функции и настройки приватности
      - **Achievement Service** - система достижений и уведомлений
      - **Notification Service** - отправка уведомлений о событиях
      - **Security Service** - аудит операций и мониторинг безопасности
      
      ## 📊 Стандартизированный формат ответов
      Все API endpoints возвращают ответы в единообразном формате:
      \`\`\`json
      {
        "success": true,
        "data": { ... },
        "error": null,
        "meta": {
          "pagination": { ... },
          "cache": { "hit": true, "ttl": 300 },
          "performance": { "processingTime": "45ms" }
        },
        "timestamp": "2024-01-15T10:00:00Z",
        "correlationId": "req_20240115_100000_abc123"
      }
      \`\`\`
      
      ## 🔄 Пагинация и производительность
      - **Cursor-based пагинация** - для больших объемов данных (рекомендуется)
      - **Offset-based пагинация** - для простых случаев использования
      - **Кэширование результатов** - автоматическое кэширование с TTL
      - **Batch операции** - массовая обработка до 5000 записей
      
      ## 🔍 Фильтрация и поиск
      Поддерживаемые параметры фильтрации:
      - \`fields\` - выбор конкретных полей для возврата
      - \`includeDeleted\` - включение soft deleted записей
      - \`includePreferences\` - включение пользовательских предпочтений
      - \`includePrivacySettings\` - включение настроек приватности
      - \`publicOnly\` - только публичные данные (для Social Service)
      
      ## 🔐 Аутентификация и безопасность
      - **API Keys** - для внутренних микросервисов
      - **Bearer Tokens** - для внутренней аутентификации
      - **IP Whitelisting** - дополнительная защита внутренних API
      - **Rate Limiting** - различные лимиты для разных сервисов
      - **Аудит операций** - логирование всех операций с данными
      
      ## 📈 Мониторинг и метрики
      - **Prometheus метрики** - производительность, кэш, ошибки
      - **Health checks** - проверка всех зависимостей
      - **Correlation ID** - трассировка запросов между сервисами
      - **Performance профилирование** - анализ узких мест
    `,
    )
    .setVersion('2.0')
    .addTag('🔐 Auth Service Integration', 'API для Auth Service - аутентификация и управление сессиями')
    .addTag('🎮 Game Catalog Integration', 'API для Game Catalog Service - персонализация каталога')
    .addTag('💳 Payment Service Integration', 'API для Payment Service - биллинговая информация')
    .addTag('📚 Library Service Integration', 'API для Library Service - игровые предпочтения')
    .addTag('👥 Social Service Integration', 'API для Social Service - социальные функции')
    .addTag('🏆 Achievement Integration', 'API для Achievement Service - система достижений')
    .addTag('⚡ Batch Operations', 'Высокопроизводительные массовые операции (до 5000 записей)')
    .addTag('👤 Profile Management', 'Управление профилями пользователей и настройками')
    .addTag('🔍 User Operations', 'Основные операции с пользователями')
    .addTag('📊 Monitoring & Health', 'Мониторинг, метрики и health checks')
    .addTag('🗄️ Cache Management', 'Управление кэшем и статистика производительности')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API ключ для внутренних микросервисов (auth-service-key, game-catalog-key, payment-service-key, etc.)',
      },
      'internal-api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Bearer токен для внутренней аутентификации микросервисов',
      },
      'internal-bearer',
    )
    .addSecurity('internal-service-header', {
      type: 'apiKey',
      name: 'x-internal-service',
      in: 'header',
      description: 'Заголовок для внутренней аутентификации сервисов',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);

  // Graceful shutdown handling for Kubernetes
  const gracefulShutdown = async (signal: string) => {
    console.log(`🔄 Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Stop accepting new requests
      await app.close();
      console.log('✅ HTTP server closed');
      
      // Give time for ongoing requests to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}
void bootstrap();
