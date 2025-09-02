import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './infrastructure/http/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable default logger for more control if needed, or configure it
    // logger: false,
  });
  const logger = app.get(Logger);

  // --- Global Prefix ---
  app.setGlobalPrefix('api/v1');

  // --- Global Pipes ---
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strips away properties that do not have any decorators
    forbidNonWhitelisted: true, // Throws an error if non-whitelisted values are provided
    transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // --- Global Filters ---
  app.useGlobalFilters(new HttpExceptionFilter());

  // --- Swagger (OpenAPI) ---
  const config = new DocumentBuilder()
    .setTitle('Game Catalog Service API')
    .setDescription('API documentation for the Game Catalog Service of the Cryo project.')
    .setVersion('1.0')
    .addBearerAuth() // If we use JWT Bearer auth
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
