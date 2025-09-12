import { Payment } from '../entities/payment.entity';

export interface ProcessPaymentResponse {
  paymentUrl: string;
  externalId: string;
}

export interface PaymentProviderInterface {
  processPayment(payment: Payment): Promise<ProcessPaymentResponse>;
  getPaymentStatus(externalId: string): Promise<{ status: string; providerResponse: any }>;
  handleWebhook(data: any): { externalId: string; status: string };
}
