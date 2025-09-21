import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { useContainer } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { LogLevel } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const logLevelEnv = (process.env.LOG_LEVEL || 'log').toLowerCase();
  const allLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const levelIndex = Math.max(0, allLevels.findIndex((l) => l === (logLevelEnv as LogLevel)));
  const logger = allLevels.slice(0, levelIndex + 1) as LogLevel[];

  const app = await NestFactory.create(AppModule, { logger });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable DI in class-validator custom decorators/constraints
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Trust proxy (Ingress/Load Balancer) for correct client IPs
  const httpAdapter = app.getHttpAdapter();
  const instance: any = (httpAdapter as any).getInstance?.();
  if (instance?.set) instance.set('trust proxy', 1);

  // --- Swagger API Documentation ---
  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('Cryo API Gateway documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  // Graceful shutdown hooks
  app.enableShutdownHooks();
  const shutdown = async (signal: string) => {
    try {
      // eslint-disable-next-line no-console
      console.log(`[Gateway] Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Gateway] Error during shutdown', e);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
