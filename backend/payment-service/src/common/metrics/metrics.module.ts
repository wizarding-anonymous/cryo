import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      defaultLabels: {
        app: 'payment-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'payment_service_',
        },
      },
    }),
  ],
  providers: [
    MetricsService,
    // Payment metrics
    makeCounterProvider({
      name: 'payments_total',
      help: 'Total number of payments processed',
      labelNames: ['status', 'provider', 'error_type'],
    }),
    makeHistogramProvider({
      name: 'payment_duration_seconds',
      help: 'Duration of payment processing in seconds',
      labelNames: ['provider'],
      buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 3, 5, 10],
    }),
    makeHistogramProvider({
      name: 'payment_amount_histogram',
      help: 'Distribution of payment amounts',
      labelNames: ['currency', 'provider'],
      buckets: [100, 500, 1000, 2000, 5000, 10000, 20000, 50000],
    }),
    makeGaugeProvider({
      name: 'active_payments_gauge',
      help: 'Number of currently active payments',
      labelNames: ['provider'],
    }),
    // Order metrics
    makeCounterProvider({
      name: 'orders_total',
      help: 'Total number of orders created',
      labelNames: ['status', 'game_id'],
    }),
    makeHistogramProvider({
      name: 'order_duration_seconds',
      help: 'Duration of order processing in seconds',
      labelNames: ['status'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5],
    }),
    // Provider metrics
    makeCounterProvider({
      name: 'payment_provider_requests_total',
      help: 'Total requests to payment providers',
      labelNames: ['provider', 'operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'payment_provider_duration_seconds',
      help: 'Duration of payment provider requests',
      labelNames: ['provider', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }),
    // Integration metrics
    makeCounterProvider({
      name: 'integration_requests_total',
      help: 'Total requests to external services',
      labelNames: ['service', 'operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'integration_duration_seconds',
      help: 'Duration of external service requests',
      labelNames: ['service', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    }),
    // Webhook metrics
    makeCounterProvider({
      name: 'webhook_requests_total',
      help: 'Total webhook requests received',
      labelNames: ['provider', 'status'],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
