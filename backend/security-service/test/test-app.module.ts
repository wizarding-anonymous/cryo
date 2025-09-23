import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonLogger } from '../src/config/logger.config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from '../src/modules/health/health.controller';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { SecurityAlert } from '../src/entities/security-alert.entity';
import { IPBlock } from '../src/entities/ip-block.entity';
import { SecurityController } from '../src/modules/security/security.controller';
import { LogsController } from '../src/modules/logs/logs.controller';
import { AlertsController } from '../src/modules/alerts/alerts.controller';
import { SecurityService } from '../src/modules/security/security.service';
import { LoggingService } from '../src/modules/logs/logging.service';
import { MonitoringService } from '../src/modules/alerts/monitoring.service';
import { RateLimitService } from '../src/modules/security/rate-limit.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MetricsService } from '../src/common/metrics/metrics.service';
import { UserServiceClient } from '../src/clients/user-service.client';
import { NotificationServiceClient } from '../src/clients/notification-service.client';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env.local', '.env'],
    }),
    WinstonModule.forRoot(winstonLogger),
    JwtModule.register({ global: true }),
    // Override the main database connection for the testing environment
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const testDbUrl = config.get<string>('TEST_DATABASE_URL');
        if (!testDbUrl) {
          // Fallback to a local test DB if the env var is not set
          console.warn('TEST_DATABASE_URL not set, falling back to local test DB config.');
          return {
            type: 'postgres' as const,
            host: 'localhost',
            port: 5436, // Match docker-compose port
            username: 'postgres',
            password: 'postgres',
            database: 'security_service_test',
            autoLoadEntities: true,
            synchronize: true, // Enable synchronize for clean test environment
            dropSchema: true, // Drop schema for clean slate
            logging: false, // Disable SQL logging in tests
            migrationsRun: false, // Don't run migrations automatically
          };
        }
        return {
          type: 'postgres' as const,
          url: testDbUrl,
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
          logging: false,
          migrationsRun: false,
        };
      },
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
    {
      provide: REDIS_CLIENT,
      useValue: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(-1),
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
  ],
})
export class TestAppModule { }
