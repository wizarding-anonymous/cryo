import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationConfig } from './config/validation.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe(validationConfig));

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // API prefix
  const apiPrefix = configService.get('app.api.prefix')!;
  app.setGlobalPrefix(apiPrefix);

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger documentation
  if (configService.get('app.environment') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle(configService.get('app.api.title')!)
      .setDescription(configService.get('app.api.description')!)
      .setVersion(configService.get('app.api.version')!)
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Start server
  const port = configService.get('app.port')!;
  await app.listen(port);

  logger.log(`🚀 Review Service is running on: http://localhost:${port}/${apiPrefix}`);

  if (configService.get('app.environment') !== 'production') {
    logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
