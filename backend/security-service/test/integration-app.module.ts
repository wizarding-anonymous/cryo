import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonLogger } from '../src/config/logger.config';
import { JwtModule } from '@nestjs/jwt';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { SecurityAlert } from '../src/entities/security-alert.entity';
import { IPBlock } from '../src/entities/ip-block.entity';
import { SecurityController } from '../src/modules/security/security.controller';
import { LogsController } from '../src/modules/logs/logs.controller';
import { AlertsController } from '../src/modules/alerts/alerts.controller';
import { HealthController } from '../src/modules/health/health.controller';
import { SecurityService } from '../src/modules/security/security.service';
import { LoggingService } from '../src/modules/logs/logging.service';
import { MonitoringService } from '../src/modules/alerts/monitoring.service';
import { RateLimitService } from '../src/modules/security/rate-limit.service';
import { MetricsService } from '../src/common/metrics/metrics.service';
import { UserServiceClient } from '../src/clients/user-service.client';
import { NotificationServiceClient } from '../src/clients/notification-service.client';
import { EncryptionService } from '../src/common/encryption/encryption.service';
import { AuthService } from '../src/common/auth/auth.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { KAFKA_PRODUCER_SERVICE } from '../src/kafka/kafka.constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env.local', '.env'],
    }),
    WinstonModule.forRoot(winstonLogger),
    JwtModule.register({ 
      global: true,
      secret: 'test-secret',
      signOptions: { expiresIn: '1h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5436'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'security_service_test',
      entities: [SecurityEvent, SecurityAlert, IPBlock],
      synchronize: true,
      dropSchema: false, // Don't drop schema as it's handled in setup
      logging: false,
    }),
    TypeOrmModule.forFeature([SecurityEvent, SecurityAlert, IPBlock]),
  ],
  controllers: [HealthController, SecurityController, LogsController, AlertsController],
  providers: [
    SecurityService,
    LoggingService,
    MonitoringService,
    RateLimitService,
    MetricsService,
    UserServiceClient,
    NotificationServiceClient,
    EncryptionService,
    AuthService,
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6382'),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      },
    },
    {
      provide: WINSTON_MODULE_NEST_PROVIDER,
      useValue: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    },
    {
      provide: KAFKA_PRODUCER_SERVICE,
      useValue: {
        emit: jest.fn().mockResolvedValue({}),
        send: jest.fn().mockResolvedValue({}),
        connect: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      },
    },
  ],
})
export class IntegrationAppModule {}