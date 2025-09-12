import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      defaultLabels: {
        app: 'payment-service',
      },
    }),
  ],
  providers: [
    MetricsService,
    makeCounterProvider({
      name: 'payments_total',
      help: 'Total number of payments processed',
      labelNames: ['status', 'provider'],
    }),
    makeHistogramProvider({
      name: 'payment_duration_seconds',
      help: 'Duration of payment processing in seconds',
      labelNames: ['provider'],
      buckets: [0.1, 0.5, 1, 1.5, 2, 5],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
