import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingMiddleware } from './infrastructure/middleware/logging.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(new LoggingMiddleware().use);

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription('API for user management and basic developer/publisher profiles')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Developer Profiles', 'Basic developer profile operations')
    .addTag('Publisher Profiles', 'Basic publisher profile operations')
    .addTag('Verification', 'Verification status operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
