import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createWinstonConfig } from './common/logging/winston.config';

async function bootstrap() {
  // Create Winston configuration based on environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel =
    process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug');
  const logFormat =
    (process.env.LOG_FORMAT as 'json' | 'simple') ||
    (nodeEnv === 'production' ? 'json' : 'simple');
  const serviceName = process.env.SERVICE_NAME || 'user-service';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

  const winstonConfig = createWinstonConfig({
    level: logLevel,
    format: logFormat,
    nodeEnv,
    serviceName,
    serviceVersion,
  });

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // Get HttpAdapterHost to use with the global exception filter
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));

  // Apply global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove non-whitelisted properties
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted values are provided
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // --- Swagger API Documentation ---
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription('API documentation for the User Service microservice')
    .setVersion('1.0')
    .addBearerAuth() // For JWT authentication
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
}
void bootstrap();
