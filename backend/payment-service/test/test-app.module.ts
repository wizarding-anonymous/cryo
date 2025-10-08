import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import {
  TerminusModule,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { OrderController } from '../src/modules/order/order.controller';
import { PaymentController } from '../src/modules/payment/payment.controller';
import { WebhookController } from '../src/modules/payment/webhook.controller';
import { HealthController } from '../src/modules/health/health.controller';
import { OrderService } from '../src/modules/order/order.service';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PaymentProviderService } from '../src/modules/payment/payment-provider.service';
import { PaymentEventsService } from '../src/modules/payment/payment-events.service';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { MetricsService } from '../src/common/metrics/metrics.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/modules/payment/entities/payment.entity';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
    }),
    JwtModule.register({
      secret:
        'test_jwt_secret_key_here_make_it_long_and_secure_minimum_32_chars',
      signOptions: { expiresIn: '1h' },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000, // Higher limit for tests
      },
    ]),
    TerminusModule,
  ],
  controllers: [
    OrderController,
    PaymentController,
    WebhookController,
    HealthController,
  ],
  providers: [
    OrderService,
    PaymentService,
    PaymentProviderService,
    PaymentEventsService,
    GameCatalogIntegrationService,
    LibraryIntegrationService,
    MetricsService,
    ResponseInterceptor,
    // Mock repository
    {
      provide: getRepositoryToken(Payment),
      useValue: {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
      },
    },
    // Mock Prometheus metrics
    {
      provide: 'PROM_METRIC_PAYMENTS_TOTAL',
      useValue: { inc: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_PAYMENT_DURATION_SECONDS',
      useValue: { observe: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_ORDERS_TOTAL',
      useValue: { inc: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_ORDER_DURATION_SECONDS',
      useValue: { observe: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_PAYMENT_PROVIDER_REQUESTS_TOTAL',
      useValue: { inc: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_PAYMENT_PROVIDER_DURATION_SECONDS',
      useValue: { observe: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_INTEGRATION_REQUESTS_TOTAL',
      useValue: { inc: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_INTEGRATION_DURATION_SECONDS',
      useValue: { observe: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_ACTIVE_PAYMENTS_GAUGE',
      useValue: { inc: jest.fn(), dec: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_WEBHOOK_REQUESTS_TOTAL',
      useValue: { inc: jest.fn() },
    },
    {
      provide: 'PROM_METRIC_PAYMENT_AMOUNT_HISTOGRAM',
      useValue: { observe: jest.fn() },
    },
    // Mock Cache Manager
    {
      provide: 'CACHE_MANAGER',
      useValue: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        reset: jest.fn().mockResolvedValue(undefined),
      },
    },
    // Mock Health Check Services из @nestjs/terminus
    {
      provide: HealthCheckService,
      useValue: {
        check: jest.fn().mockResolvedValue({ status: 'ok' }),
      },
    },
    {
      provide: TypeOrmHealthIndicator,
      useValue: {
        pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
      },
    },
    {
      provide: MemoryHealthIndicator,
      useValue: {
        checkHeap: jest
          .fn()
          .mockResolvedValue({ memory_heap: { status: 'up' } }),
        checkRSS: jest.fn().mockResolvedValue({ memory_rss: { status: 'up' } }),
      },
    },
    {
      provide: DiskHealthIndicator,
      useValue: {
        checkStorage: jest
          .fn()
          .mockResolvedValue({ storage: { status: 'up' } }),
      },
    },
  ],
})
export class TestAppModule {}
