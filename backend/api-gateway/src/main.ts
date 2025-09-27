import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { GlobalValidationPipe } from './common/pipes/global-validation.pipe';
import { useContainer } from 'class-validator';
import { setupSwagger } from './config/swagger.config';
import type { LogLevel } from '@nestjs/common';
import { Logger } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = new Logger('Bootstrap');

  // Configure logging levels based on environment
  const logLevelEnv = (
    process.env.LOG_LEVEL || (isProduction ? 'warn' : 'log')
  ).toLowerCase();
  const allLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const levelIndex = Math.max(
    0,
    allLevels.findIndex((l) => l === (logLevelEnv as LogLevel)),
  );
  const logLevels = allLevels.slice(0, levelIndex + 1);

  // Create NestJS application with production-optimized settings
  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    bufferLogs: isProduction, // Buffer logs in production for better performance
    abortOnError: false, // Don't abort on startup errors in production
  });

  // Production security headers
  if (isProduction) {
    const httpAdapter = app.getHttpAdapter();
    const instance: any = (httpAdapter as any).getInstance?.();
    if (instance?.set) {
      instance.set('trust proxy', 1);
      instance.disable('x-powered-by'); // Remove Express signature
      // Add security headers
      instance.use((_req: any, res: any, next: any) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
      });
    }
  } else {
    // Development: Trust proxy for correct client IPs
    const httpAdapter = app.getHttpAdapter();
    const instance: any = (httpAdapter as any).getInstance?.();
    if (instance?.set) instance.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new GlobalValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable DI in class-validator custom decorators/constraints
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Setup Swagger only in non-production environments
  if (!isProduction) {
    setupSwagger(app);
  }

  const port = Number(process.env.PORT ?? 3000);

  // Enhanced graceful shutdown
  app.enableShutdownHooks();

  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`[${signal}] Shutdown already in progress, forcing exit...`);
      process.exit(1);
    }

    isShuttingDown = true;
    logger.log(
      `[${signal}] Received shutdown signal, starting graceful shutdown...`,
    );

    try {
      // Set a timeout for graceful shutdown
      const shutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout

      logger.log('Closing HTTP server...');
      await app.close();

      clearTimeout(shutdownTimeout);
      logger.log('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections in production
  if (isProduction) {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      void gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      void gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  await app.listen(port);

  logger.log(`🚀 API Gateway started successfully`);
  logger.log(`📡 Server running on port ${port}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📊 Log level: ${logLevelEnv}`);

  if (!isProduction) {
    logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
