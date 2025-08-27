import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './infrastructure/middleware/logging.middleware';
import { RateLimitMiddleware } from './infrastructure/middleware/rate-limit.middleware';
import { ApiKeyAuthMiddleware } from './infrastructure/middleware/api-key-auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply middleware
  app.use(new LoggingMiddleware().use);
  
  // Get middleware instances from DI container
  const rateLimitMiddleware = app.get(RateLimitMiddleware);
  const apiKeyAuthMiddleware = app.get(ApiKeyAuthMiddleware);
  
  app.use(rateLimitMiddleware.use.bind(rateLimitMiddleware));
  app.use(apiKeyAuthMiddleware.use.bind(apiKeyAuthMiddleware));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription('API for user management and basic developer/publisher profiles')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Developer Profiles', 'Basic developer profile operations')
    .addTag('Publisher Profiles', 'Basic publisher profile operations')
    .addTag('Verification', 'Verification status operations')
    .addTag('Integration Monitoring', 'Integration health and event monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
