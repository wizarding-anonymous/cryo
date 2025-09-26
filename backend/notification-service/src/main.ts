import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Configure logger for production
  if (process.env.NODE_ENV === 'production') {
    Logger.overrideLogger({
      log: (message: string, context?: string) => {
        console.log(
          JSON.stringify({
            level: 'info',
            timestamp: new Date().toISOString(),
            context,
            message,
            service: 'notification-service',
          }),
        );
      },
      error: (message: string, trace?: string, context?: string) => {
        console.error(
          JSON.stringify({
            level: 'error',
            timestamp: new Date().toISOString(),
            context,
            message,
            trace,
            service: 'notification-service',
          }),
        );
      },
      warn: (message: string, context?: string) => {
        console.warn(
          JSON.stringify({
            level: 'warn',
            timestamp: new Date().toISOString(),
            context,
            message,
            service: 'notification-service',
          }),
        );
      },
      debug: (message: string, context?: string) => {
        if (process.env.LOG_LEVEL === 'debug') {
          console.debug(
            JSON.stringify({
              level: 'debug',
              timestamp: new Date().toISOString(),
              context,
              message,
              service: 'notification-service',
            }),
          );
        }
      },
      verbose: (message: string, context?: string) => {
        if (process.env.LOG_LEVEL === 'verbose') {
          console.log(
            JSON.stringify({
              level: 'verbose',
              timestamp: new Date().toISOString(),
              context,
              message,
              service: 'notification-service',
            }),
          );
        }
      },
    });
  }

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global logging interceptor for all operations
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global validation pipe with production optimizations
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // CORS configuration for cross-domain requests
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8080',
        ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-HTTP-Method-Override',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Enable graceful shutdown with enhanced handling
  app.enableShutdownHooks();

  // Swagger documentation (only in non-production environments)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Notification Service API')
      .setDescription(
        'API для микросервиса уведомлений российской игровой платформы',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // Enhanced graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    const shutdownTimeout = parseInt(
      process.env.SHUTDOWN_TIMEOUT || '10000',
      10,
    );

    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, shutdownTimeout);

    app
      .close()
      .then(() => {
        logger.log('Application closed successfully');
        clearTimeout(timeout);
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error during graceful shutdown', error);
        clearTimeout(timeout);
        process.exit(1);
      });
  };

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error.stack);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Notification Service запущен на порту ${port}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV}`);

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger документация: http://localhost:${port}/api`);
  }

  logger.log(`🔒 Authentication and authorization configured`);
  logger.log(`🌐 CORS configured for cross-domain requests`);
  logger.log(
    `💾 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
  );
  logger.log(`🔴 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  logger.log(`✅ Health check available at: http://localhost:${port}/health`);
}

void bootstrap();
