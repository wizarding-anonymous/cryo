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
      defaultLabels: { app: 'security-service' },
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    MetricsService,
    makeCounterProvider({
      name: 'security_checks_total',
      help: 'Total security checks',
      labelNames: ['type', 'allowed'],
    }),
    makeHistogramProvider({
      name: 'security_check_duration_seconds',
      help: 'Duration of security checks',
      labelNames: ['type'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    }),
    makeCounterProvider({
      name: 'security_alerts_total',
      help: 'Total security alerts created',
      labelNames: ['type', 'severity'],
    }),
    makeCounterProvider({
      name: 'ip_blocks_total',
      help: 'Total IP blocks executed',
      labelNames: ['reason'],
    }),
    makeCounterProvider({
      name: 'high_risk_events_total',
      help: 'Total high risk security events (>= threshold)',
      labelNames: ['type'],
    }),
    makeGaugeProvider({
      name: 'security_active_alerts',
      help: 'Current number of active (unresolved) alerts',
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
