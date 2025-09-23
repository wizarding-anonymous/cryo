import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport, type KafkaOptions } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            winston.format.json(),
          ),
        }),
      ],
    }),
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Hybrid application setup (for future Kafka integration)
  const kafkaEnabled =
    configService.get<boolean>('kafka.enabled', false) === true &&
    process.env.NODE_ENV !== 'test';

  if (kafkaEnabled) {
    try {
      const kafkaBroker = configService.get<string>('kafka.broker') ?? 'localhost:9092';
      const kafkaOptions: KafkaOptions = {
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [kafkaBroker],
          },
          consumer: {
            groupId: 'library-service-consumer',
          },
        },
      };
      app.connectMicroservice(kafkaOptions);
      await app.startAllMicroservices();
      logger.log('🔗 Kafka microservice connected');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const context = error instanceof Error ? error.stack : undefined;
      logger.warn(
        `⚠️ Kafka connection failed, continuing without Kafka. Reason: ${message}`,
        context,
      );
    }
  } else {
    logger.log('⏭️ Kafka disabled for this environment');
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors for logging and response transformation
  app.useGlobalInterceptors(
    new (require('./common/interceptors/logging.interceptor').LoggingInterceptor)(),
    new (require('./common/interceptors/transform.interceptor').TransformInterceptor)(),
  );

  // Global exception filter
  app.useGlobalFilters(
    new (require('./common/filters/global-exception.filter').GlobalExceptionFilter)(),
  );

  // CORS configuration
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') ?? 'Library Service API')
    .setDescription(
      configService.get<string>('swagger.description') ?? 'API for managing user game libraries',
    )
    .setVersion(configService.get<string>('swagger.version') ?? '1.0')
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
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(
    configService.get<string>('swagger.path') ?? 'api/docs',
    app,
    document,
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  );

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Library Service is running on: http://localhost:${port}`);
  logger.log(
    `📚 Swagger documentation: http://localhost:${port}/${
      configService.get<string>('swagger.path') ?? 'api/docs'
    }`,
  );
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});
