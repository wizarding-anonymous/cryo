// Optional APM agent initialization (loaded before the app for capture)
(() => {
  try {
    // Only start APM if ELASTIC_APM_SERVER_URL is set
    if (process.env.ELASTIC_APM_SERVER_URL) {
      require('elastic-apm-node').start({
        serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'library-service',
        serverUrl: process.env.ELASTIC_APM_SERVER_URL,
        secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
        environment: process.env.NODE_ENV || 'development',
        captureHeaders: true,
        captureBody: 'transactions',
        active: true,
      });

      console.log('[APM] Elastic APM agent initialized');
    }
  } catch (e) {
    console.warn('[APM] Elastic APM initialization skipped:', e);
  }
})();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport, type KafkaOptions } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { 
  CustomValidationPipe,
  LoggingInterceptor,
  TransformInterceptor,
  GlobalExceptionFilter 
} from './common';
import { ProductionLoggingInterceptor } from './common/interceptors/production-logging.interceptor';
import { createWinstonConfig } from './config/logging.config';
import { validateProductionConfig } from './config/production.config';
import { GracefulShutdownService } from './common/services/graceful-shutdown.service';
import { PrometheusMetricsService } from './monitoring/prometheus-metrics.service';

async function bootstrap(): Promise<void> {
  // Validate production configuration
  try {
    validateProductionConfig();
  } catch (error) {
    console.error('Production configuration validation failed:', error);
    process.exit(1);
  }

  // Create application with structured logging
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createWinstonConfig()),
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Setup graceful shutdown
  app.enableShutdownHooks();
  const gracefulShutdown = app.get(GracefulShutdownService);
  
  // Register shutdown handlers
  try {
    const dataSource = app.get('DataSource');
    if (dataSource) {
      gracefulShutdown.registerShutdownHandler(
        GracefulShutdownService.createDatabaseShutdownHandler(dataSource)
      );
    }
  } catch (error) {
    logger.warn('Failed to get DataSource for graceful shutdown');
  }

  // Hybrid application setup (for future Kafka integration)
  const kafkaEnabled =
    configService.get<boolean>('kafka.enabled', false) === true &&
    process.env.NODE_ENV !== 'test';

  if (kafkaEnabled) {
    try {
      const kafkaBroker =
        configService.get<string>('kafka.broker') ?? 'localhost:9092';
      const kafkaOptions: KafkaOptions = {
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [kafkaBroker],
          },
          consumer: {
            groupId: 'library-service-consumer',
          },
        },
      };
      app.connectMicroservice(kafkaOptions);
      await app.startAllMicroservices();
      logger.log('🔗 Kafka microservice connected');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const context = error instanceof Error ? error.stack : undefined;
      logger.warn(
        `⚠️ Kafka connection failed, continuing without Kafka. Reason: ${message}`,
        context,
      );
    }
  } else {
    logger.log('⏭️ Kafka disabled for this environment');
  }

  // Enhanced global validation pipe with custom validators
  app.useGlobalPipes(new CustomValidationPipe());

  // Enhanced global interceptors for logging and response transformation
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Use production logging interceptor with structured logging and metrics
    try {
      const metricsService = app.get(PrometheusMetricsService);
      app.useGlobalInterceptors(
        new ProductionLoggingInterceptor(configService, metricsService),
        new TransformInterceptor(),
      );
    } catch (error) {
      logger.warn('Failed to get PrometheusMetricsService, using production logging without metrics');
      app.useGlobalInterceptors(
        new ProductionLoggingInterceptor(configService),
        new TransformInterceptor(),
      );
    }
  } else {
    // Use development logging interceptor
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );
  }

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS configuration
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle(
      configService.get<string>('swagger.title') ?? 'Library Service API',
    )
    .setDescription(
      configService.get<string>('swagger.description') ??
        `# Library Service API

API for managing user game libraries in the Russian Gaming Platform.

## Overview

This service provides comprehensive library management functionality including:
- **User game library management** - View and manage purchased games
- **Purchase history tracking** - Complete transaction history with details
- **Game ownership verification** - Verify user ownership for downloads
- **Search and filtering capabilities** - Find games quickly in large libraries
- **Integration with external services** - Payment, Game Catalog, and User services

## Authentication

Most endpoints require JWT authentication. Use the 'Authorize' button below to set your JWT token.

### Getting a JWT Token
1. Authenticate with the User Service
2. Copy the returned JWT token
3. Click 'Authorize' and paste the token (without 'Bearer ' prefix)

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability:
- **Public endpoints**: 100 requests per minute
- **Authenticated endpoints**: 1000 requests per minute
- **Internal endpoints**: No rate limiting

## Error Handling

All endpoints return standardized error responses with:
- **HTTP status codes** following REST conventions
- **Error codes** for programmatic handling
- **Correlation IDs** for request tracking
- **Detailed validation errors** when applicable

## Pagination

List endpoints support pagination with:
- **page**: Page number (default: 1)
- **limit**: Items per page (default: 20, max: 100)
- **sortBy**: Sort field
- **sortOrder**: Sort direction (asc/desc)

## Caching

Responses are cached for performance:
- **Library data**: 5 minutes
- **Search results**: 2 minutes
- **Purchase history**: 10 minutes
- **Purchase details**: 30 minutes

## Monitoring

Service health and metrics are available at:
- **/health** - Basic health check
- **/health/detailed** - Comprehensive health status
- **/health/external** - External services status
- **/metrics** - Prometheus metrics`,
    )
    .setVersion(configService.get<string>('swagger.version') ?? '1.0.0')
    .setContact(
      'Library Service Team',
      'https://github.com/your-org/library-service',
      'library-service@yourcompany.com',
    )
    .setLicense(
      'MIT',
      'https://opensource.org/licenses/MIT',
    )
    .addServer(
      configService.get<string>('swagger.server.url') ?? 'http://localhost:3000',
      configService.get<string>('swagger.server.description') ?? 'Development server',
    )
    .addServer(
      'https://api.yourgamingplatform.ru',
      'Production server',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token obtained from the authentication service',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Library', 'Game library management endpoints')
    .addTag('Purchase History', 'Purchase history and transaction tracking')
    .addTag('Health', 'Service health monitoring endpoints')
    .addTag('Metrics', 'Prometheus metrics for monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    extraModels: [],
  });

  // Examples are now defined directly in DTOs with @ApiProperty decorators
  
  SwaggerModule.setup(
    configService.get<string>('swagger.path') ?? 'api/docs',
    app,
    document,
    {
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayOperationId: false,
        showExtensions: false,
        showCommonExtensions: false,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Library Service API Documentation',
      customfavIcon: '/favicon.ico',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
      ],
      customCssUrl: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      ],
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #3b4151; font-size: 36px; }
        .swagger-ui .info .description { margin: 20px 0; }
        .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .swagger-ui .auth-wrapper { margin: 20px 0; }
        .swagger-ui .btn.authorize { background-color: #49cc90; border-color: #49cc90; }
        .swagger-ui .btn.authorize:hover { background-color: #3ea175; border-color: #3ea175; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #61affe; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #49cc90; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #f93e3e; }
        .swagger-ui .parameter__name { font-weight: bold; }
        .swagger-ui .response-col_status { font-weight: bold; }
      `,
    },
  );

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Library Service is running on: http://localhost:${port}`);
  logger.log(
    `📚 Swagger documentation: http://localhost:${port}/${
      configService.get<string>('swagger.path') ?? 'api/docs'
    }`,
  );
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});
