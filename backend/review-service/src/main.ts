import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BackgroundTasksService } from './services/background-tasks.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Configure logging based on environment
  const logLevels: ('error' | 'warn' | 'log' | 'debug' | 'verbose')[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const logLevel = (process.env.LOG_LEVEL as 'error' | 'warn' | 'log' | 'debug' | 'verbose') || 'log';

  const app = await NestFactory.create(AppModule, {
    logger: logLevels.slice(0, logLevels.indexOf(logLevel) + 1),
  });

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Review Service API')
    .setDescription('API for managing game reviews and ratings in the Russian gaming platform')
    .setVersion('1.0')
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
    .addTag('reviews', 'Game review management endpoints')
    .addTag('ratings', 'Game rating retrieval endpoints')
    .addTag('admin', 'Administrative endpoints for rating management and metrics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Start periodic rating recalculation
  const backgroundTasksService = app.get(BackgroundTasksService);
  const recalculationInterval = parseInt(process.env.RATING_RECALCULATION_INTERVAL_HOURS || '24', 10);
  await backgroundTasksService.schedulePeriodicRecalculation(recalculationInterval);

  const port = process.env.PORT ?? 3004;
  await app.listen(port);

  logger.log(`Review Service is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`Periodic rating recalculation scheduled every ${recalculationInterval} hours`);
  logger.log(`Log level set to: ${logLevel}`);
}
bootstrap();
