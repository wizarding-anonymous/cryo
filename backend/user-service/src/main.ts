import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createWinstonConfig } from './common/logging/winston.config';
import { Reflector } from '@nestjs/core';

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

  // GlobalExceptionFilter теперь применяется через APP_FILTER в AppModule
  // для правильной инжекции зависимостей

  // Apply global interceptors
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)), // For @Exclude decorator
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
    .setDescription(
      `
      API documentation for the User Service microservice
      
      ## Features
      - Standardized API responses with correlation IDs
      - Cursor-based and offset-based pagination
      - Advanced filtering and search capabilities
      - Internal microservice endpoints
      - Comprehensive error handling
      
      ## Response Format
      All public API endpoints return responses in the following standardized format:
      \`\`\`json
      {
        "success": true,
        "data": { ... },
        "error": null,
        "meta": { ... },
        "timestamp": "2023-12-01T10:00:00Z",
        "correlationId": "req_123456789"
      }
      \`\`\`
      
      ## Pagination
      - **Offset-based**: Use \`page\` and \`limit\` parameters
      - **Cursor-based**: Use \`cursor\` parameter for better performance with large datasets
      - Both methods support sorting with \`sortBy\` and \`sortOrder\` parameters
      
      ## Filtering
      Most list endpoints support filtering through query parameters:
      - Text fields: partial matching (case-insensitive)
      - Boolean fields: exact matching
      - Date fields: range filtering with \`from\` and \`to\` suffixes
    `,
    )
    .setVersion('2.0')
    .addTag('Users', 'User management endpoints with pagination and filtering')
    .addTag(
      'Internal Microservice APIs',
      'Internal endpoints for microservice communication',
    )
    .addTag(
      'Batch Operations',
      'Bulk operations for high-performance scenarios',
    )
    .addTag('Health', 'Service health and monitoring endpoints')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'Internal API key for microservice authentication',
      },
      'internal-api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Internal JWT token for microservice authentication',
      },
      'internal-bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);

  // Graceful shutdown handling for Kubernetes
  const gracefulShutdown = async (signal: string) => {
    console.log(`🔄 Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Stop accepting new requests
      await app.close();
      console.log('✅ HTTP server closed');
      
      // Give time for ongoing requests to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}
void bootstrap();
