import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BackgroundTasksService } from './services/background-tasks.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Review Service is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
  console.log(`Periodic rating recalculation scheduled every ${recalculationInterval} hours`);
}
bootstrap();
