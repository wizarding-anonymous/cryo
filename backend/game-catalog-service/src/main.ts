// Polyfill for crypto in Node.js environments
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { HealthMonitoringInterceptor } from './health/health-monitoring.interceptor';
import { LoggingService } from './health/logging.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // Get services for monitoring
    const loggingService = app.get(LoggingService);
    const healthMonitoringInterceptor = app.get(HealthMonitoringInterceptor);

    // --- Global Interceptors ---
    app.useGlobalInterceptors(
      new RequestLoggingInterceptor(),
      healthMonitoringInterceptor,
    );

    // --- Global Exception Filter ---
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));

    // --- Global Prefix ---
    app.setGlobalPrefix('api');

    // --- Global Validation Pipe ---
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // --- Swagger API Documentation ---
    if (process.env.SWAGGER_ENABLED !== 'false') {
      const config = new DocumentBuilder()
        .setTitle('Game Catalog Service API')
        .setDescription(
          'Comprehensive REST API for the Game Catalog Service - part of the Russian Gaming Platform MVP. ' +
            'Provides high-performance game catalog browsing, search functionality, and integration endpoints for other microservices. ' +
            'Features include full-text search with Russian language support, Redis caching for sub-200ms response times, ' +
            'and specialized endpoints for Payment Service integration.',
        )
        .setVersion('1.0.0')
        .setContact(
          'Game Catalog Service Team',
          'https://gaming-platform.ru/docs',
          'support@gaming-platform.ru',
        )
        .setLicense('MIT', 'https://opensource.org/licenses/MIT')
        .addServer('http://localhost:3002', 'Development Server')
        .addServer(
          'https://api.gaming-platform.ru/catalog',
          'Production Server',
        )
        .addTag('Games', 'Game catalog management and retrieval operations')
        .addTag(
          'Search',
          'Full-text search operations with filtering and pagination',
        )
        .addTag(
          'Health',
          'Health check and monitoring endpoints for Kubernetes probes',
        )
        .addTag(
          'Purchase',
          'Purchase information endpoints for Payment Service integration',
        )
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
        .build();

      const document = SwaggerModule.createDocument(app, config, {
        operationIdFactory: (controllerKey: string, methodKey: string) =>
          methodKey,
        deepScanRoutes: true,
      });

      // Add custom CSS for better documentation appearance
      const customCss = `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #2c3e50; }
        .swagger-ui .info .description { font-size: 14px; line-height: 1.6; }
        .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; border-radius: 4px; }
      `;

      SwaggerModule.setup('api-docs', app, document, {
        customCss,
        customSiteTitle: 'Game Catalog Service API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          showRequestHeaders: true,
          tryItOutEnabled: true,
        },
      });
    } else {
      logger.log('Swagger documentation is disabled in production mode');
    }

    // Use port 3002 as specified in the integration map
    const port = process.env.PORT || 3002;

    // Log Swagger documentation URL if enabled
    if (process.env.SWAGGER_ENABLED !== 'false') {
      logger.log(
        `Swagger documentation enabled at: http://localhost:${port}/api-docs`,
      );
    }

    // --- Graceful Shutdown Handling ---
    process.on('SIGTERM', () => {
      void (async () => {
        logger.log('SIGTERM received, shutting down gracefully');
        loggingService.logShutdown('SIGTERM');
        await app.close();
        process.exit(0);
      })();
    });

    process.on('SIGINT', () => {
      void (async () => {
        logger.log('SIGINT received, shutting down gracefully');
        loggingService.logShutdown('SIGINT');
        await app.close();
        process.exit(0);
      })();
    });

    // --- Unhandled Exception Handling ---
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      loggingService.logError(error, 'uncaught_exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown, promise) => {
      const reasonStr =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : JSON.stringify(reason);
      logger.error('Unhandled Rejection at:', promise, 'reason:', reasonStr);
      loggingService.logError(new Error(reasonStr), 'unhandled_rejection');
    });
    const environment = process.env.NODE_ENV || 'development';

    await app.listen(port);

    logger.log(
      `Game Catalog Service is running on port ${port} in ${environment} mode`,
    );
    loggingService.logStartup(Number(port), environment);

    // Log initial health status
    logger.log('Health endpoints available:');
    logger.log(`  - Health Check: http://localhost:${port}/api/v1/health`);
    logger.log(`  - Readiness: http://localhost:${port}/api/v1/health/ready`);
    logger.log(`  - Liveness: http://localhost:${port}/api/v1/health/live`);
    logger.log(`  - Metrics: http://localhost:${port}/metrics`);
    logger.log(`  - API Docs: http://localhost:${port}/api-docs`);
  } catch (error) {
    logger.error('Failed to start Game Catalog Service:', error);
    process.exit(1);
  }
}

void bootstrap();
