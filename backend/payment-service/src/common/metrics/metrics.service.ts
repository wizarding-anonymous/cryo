import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('payments_total') public paymentsTotal: Counter<string>,
    @InjectMetric('payment_duration_seconds')
    public paymentDuration: Histogram<string>,
    @InjectMetric('orders_total') public ordersTotal: Counter<string>,
    @InjectMetric('order_duration_seconds')
    public orderDuration: Histogram<string>,
    @InjectMetric('payment_provider_requests_total')
    public providerRequestsTotal: Counter<string>,
    @InjectMetric('payment_provider_duration_seconds')
    public providerDuration: Histogram<string>,
    @InjectMetric('integration_requests_total')
    public integrationRequestsTotal: Counter<string>,
    @InjectMetric('integration_duration_seconds')
    public integrationDuration: Histogram<string>,
    @InjectMetric('active_payments_gauge')
    public activePaymentsGauge: Gauge<string>,
    @InjectMetric('webhook_requests_total')
    public webhookRequestsTotal: Counter<string>,
    @InjectMetric('payment_amount_histogram')
    public paymentAmountHistogram: Histogram<string>,
  ) {}

  // Payment metrics
  recordPayment(status: string, provider: string) {
    this.paymentsTotal.inc({ status, provider });
  }

  recordPaymentDuration(provider: string, durationInSeconds: number) {
    this.paymentDuration.observe({ provider }, durationInSeconds);
  }

  recordPaymentAmount(amount: number, currency: string, provider: string) {
    this.paymentAmountHistogram.observe({ currency, provider }, amount);
  }

  incrementActivePayments(provider: string) {
    this.activePaymentsGauge.inc({ provider });
  }

  decrementActivePayments(provider: string) {
    this.activePaymentsGauge.dec({ provider });
  }

  // Order metrics
  recordOrder(status: string, gameId?: string) {
    this.ordersTotal.inc({ status, game_id: gameId || 'unknown' });
  }

  recordOrderDuration(durationInSeconds: number, status: string) {
    this.orderDuration.observe({ status }, durationInSeconds);
  }

  // Provider metrics
  recordProviderRequest(provider: string, operation: string, status: string) {
    this.providerRequestsTotal.inc({ provider, operation, status });
  }

  recordProviderDuration(
    provider: string,
    operation: string,
    durationInSeconds: number,
  ) {
    this.providerDuration.observe({ provider, operation }, durationInSeconds);
  }

  // Integration metrics
  recordIntegrationRequest(service: string, operation: string, status: string) {
    this.integrationRequestsTotal.inc({ service, operation, status });
  }

  recordIntegrationDuration(
    service: string,
    operation: string,
    durationInSeconds: number,
  ) {
    this.integrationDuration.observe({ service, operation }, durationInSeconds);
  }

  // Webhook metrics
  recordWebhook(provider: string, status: string) {
    this.webhookRequestsTotal.inc({ provider, status });
  }

  // Business metrics
  recordPaymentConversion(provider: string, converted: boolean) {
    this.paymentsTotal.inc({
      status: converted ? 'conversion_success' : 'conversion_failed',
      provider,
    });
  }

  recordPaymentError(provider: string, errorType: string) {
    this.paymentsTotal.inc({
      status: 'error',
      provider,
      error_type: errorType,
    });
  }
}
