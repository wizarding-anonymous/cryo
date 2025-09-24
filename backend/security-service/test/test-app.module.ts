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
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { KAFKA_PRODUCER_SERVICE } from '../src/kafka/kafka.constants';
import { EncryptionService } from '../src/common/encryption/encryption.service';
import { AuthService } from '../src/common/auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env.local', '.env'],
    }),
    WinstonModule.forRoot(winstonLogger),
    JwtModule.register({ global: true }),
    // Mock TypeORM for testing - no real database needed
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [],
      synchronize: false,
      logging: false,
    }),
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
      useValue: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(-1),
        multi: jest.fn(() => ({
          get: jest.fn().mockReturnThis(),
          incr: jest.fn().mockReturnThis(),
          ttl: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([[null, null], [null, 1], [null, -1]]),
        })),
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
    // Mock repositories
    {
      provide: getRepositoryToken(SecurityEvent),
      useValue: (() => {
        const events: any[] = [];
        return {
          create: jest.fn((dto) => ({ id: '1', ...dto, createdAt: new Date() })),
          save: jest.fn((entity) => {
            const saved = { id: '1', ...entity };
            events.push(saved);
            return Promise.resolve(saved);
          }),
          find: jest.fn(() => Promise.resolve([...events])),
          findOne: jest.fn(() => Promise.resolve(events[0] || null)),
          clear: jest.fn(() => {
            events.length = 0;
            return Promise.resolve();
          }),
          count: jest.fn(() => Promise.resolve(events.length)),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
          })),
        };
      })(),
    },
    {
      provide: getRepositoryToken(SecurityAlert),
      useValue: {
        create: jest.fn((dto) => ({ id: '1', ...dto, createdAt: new Date() })),
        save: jest.fn((entity) => Promise.resolve({ id: '1', ...entity })),
        find: jest.fn(() => Promise.resolve([])),
        findOne: jest.fn(() => Promise.resolve(null)),
        clear: jest.fn(() => Promise.resolve()),
        count: jest.fn(() => Promise.resolve(0)),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
        })),
      },
    },
    {
      provide: getRepositoryToken(IPBlock),
      useValue: {
        create: jest.fn((dto) => ({ id: '1', ...dto, createdAt: new Date() })),
        save: jest.fn((entity) => Promise.resolve({ id: '1', ...entity })),
        find: jest.fn(() => Promise.resolve([])),
        findOne: jest.fn(() => Promise.resolve(null)),
        clear: jest.fn(() => Promise.resolve()),
        count: jest.fn(() => Promise.resolve(0)),
      },
    },
    // Mock AuthService
    {
      provide: AuthService,
      useValue: {
        verifyBearerToken: jest.fn((authHeader) => {
          // Return null for requests without proper auth header
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return Promise.resolve(null);
          }
          
          const token = authHeader.replace('Bearer ', '');
          
          // Mock different user types based on token
          if (token.includes('admin')) {
            return Promise.resolve({ 
              id: 'admin-user-123', 
              isAdmin: true, 
              roles: ['admin'] 
            });
          } else if (token.includes('user')) {
            return Promise.resolve({ 
              id: 'regular-user-456', 
              isAdmin: false, 
              roles: ['user'] 
            });
          } else if (token === 'invalid-token' || token === 'expired.token.here') {
            return Promise.resolve(null);
          }
          
          // Default to admin for other valid-looking tokens
          return Promise.resolve({ 
            id: 'test-user', 
            isAdmin: true, 
            roles: ['admin'] 
          });
        }),
      },
    },
  ],
})
export class TestAppModule {}
