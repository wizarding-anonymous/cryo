import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*', credentials: false });
  app.use(helmet());

  // Global exception filter
  const httpAdapterHost = app.get(HttpAdapterHost);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, logger));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Security Service API')
    .setDescription('Security and monitoring endpoints for the platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3008;
  app.enableShutdownHooks();

  const server = await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Security Service is running on: http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      server.close?.();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
