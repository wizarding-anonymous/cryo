import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GracefulShutdownService } from './graceful-shutdown.service';

// Fix for crypto module in Node.js 18 with TypeORM
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers
  if (configService.get<boolean>('security.helmetEnabled', true)) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));
  }

  // Compression
  if (configService.get<boolean>('security.compressionEnabled', true)) {
    app.use(compression());
  }

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('cors.origin', 'http://localhost:3000'),
    credentials: configService.get<boolean>('cors.credentials', true),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
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

  // Swagger configuration (only in non-production)
  if (configService.get<string>('nodeEnv') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Achievement Service API')
      .setDescription('API для сервиса достижений российской игровой платформы')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('achievements', 'Операции с достижениями')
      .addTag('progress', 'Операции с прогрессом достижений')
      .addTag('health', 'Проверка состояния сервиса')
      .addTag('metrics', 'Метрики Prometheus')
      .addTag('monitoring', 'Мониторинг интеграций')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Graceful shutdown
  const gracefulShutdownService = app.get(GracefulShutdownService);
  app.enableShutdownHooks();

  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM signal');
    await gracefulShutdownService.onApplicationShutdown('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('Received SIGINT signal');
    await gracefulShutdownService.onApplicationShutdown('SIGINT');
    process.exit(0);
  });

  const port = configService.get<number>('port', 3003);
  await app.listen(port, '0.0.0.0');
  
  logger.log(`Achievement Service is running on: http://localhost:${port}`);
  logger.log(`Environment: ${configService.get<string>('nodeEnv')}`);
  
  if (configService.get<string>('nodeEnv') !== 'production') {
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }
  
  if (configService.get<boolean>('metrics.enabled', true)) {
    logger.log(`Metrics endpoint: http://localhost:${port}/api/v1/metrics`);
  }
}

void bootstrap();
