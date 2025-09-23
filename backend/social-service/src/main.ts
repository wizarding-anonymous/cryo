import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Global logger instance
const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    // Create application with logging configuration
    const app = await NestFactory.create(AppModule, {
      logger:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn', 'log']
          : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
      }),
    );

    // CORS configuration
    app.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Swagger documentation (only in non-production environments)
    if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
      const config = new DocumentBuilder()
        .setTitle('Social Service API')
        .setDescription('Social Service for Russian Gaming Platform MVP')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
      logger.log('Swagger documentation enabled at /api/docs');
    }

    // Enable graceful shutdown hooks
    app.enableShutdownHooks();

    const port = process.env.PORT || 3003;
    await app.listen(port);

    logger.log(`Social Service is running on: http://localhost:${port}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`Process ID: ${process.pid}`);

    if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
      logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
    }

    // Setup graceful shutdown
    setupGracefulShutdown(app);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(app: any) {
  // Handle SIGTERM (Kubernetes sends this for graceful shutdown)
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, starting graceful shutdown...');

    try {
      // Stop accepting new connections
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.log('SIGINT received, starting graceful shutdown...');

    try {
      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  logger.log('Graceful shutdown handlers configured');
}

bootstrap();
