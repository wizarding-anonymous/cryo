import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('payments_total') public paymentsTotal: Counter<string>,
    @InjectMetric('payment_duration_seconds') public paymentDuration: Histogram<string>,
  ) {}

  recordPayment(status: string, provider: string) {
    this.paymentsTotal.inc({ status, provider });
  }

  recordPaymentDuration(provider: string, durationInSeconds: number) {
    this.paymentDuration.observe({ provider }, durationInSeconds);
  }
}
