import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { Transport } from '@nestjs/microservices';

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
  // Only enable Kafka if not in test environment and if explicitly enabled
  const kafkaEnabled = configService.get('kafka.enabled', 'true') === 'true' && process.env.NODE_ENV !== 'test';
  
  if (kafkaEnabled) {
    try {
      app.connectMicroservice({
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [configService.get('kafka.broker', 'localhost:9092')],
          },
          consumer: {
            groupId: 'library-service-consumer',
          },
        },
      });
      await app.startAllMicroservices();
      logger.log('🔗 Kafka microservice connected');
    } catch (error) {
      logger.warn('⚠️ Kafka connection failed, continuing without Kafka', error.message);
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
  app.useGlobalFilters(new (require('./common/filters/global-exception.filter').GlobalExceptionFilter)());

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
    .setTitle(
      configService.get<string>('swagger.title') ?? 'Library Service API',
    )
    .setDescription(
      configService.get<string>('swagger.description') ??
        'API for managing user game libraries',
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
    `📚 Swagger documentation: http://localhost:${port}/${configService.get<string>('swagger.path') ?? 'api/docs'}`,
  );
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});
