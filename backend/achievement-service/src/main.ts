import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Achievement Service API')
    .setDescription('API для сервиса достижений российской игровой платформы')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('achievements', 'Операции с достижениями')
    .addTag('progress', 'Операции с прогрессом достижений')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  
  console.log(`Achievement Service is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
