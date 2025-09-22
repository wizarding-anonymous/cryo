import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../entities/payment.entity';
import {
  PaymentProviderInterface,
  ProcessPaymentResponse,
} from '../interfaces/payment-provider.interface';
import { SimulationConfig } from '../payment-provider.factory';

@Injectable()
export class SberbankMockProvider implements PaymentProviderInterface {
  private readonly logger = new Logger(SberbankMockProvider.name);

  constructor(private readonly config: SimulationConfig) {}

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    this.logger.log(`Processing Sberbank payment for order ${payment.orderId}, amount: ${payment.amount} RUB`);
    
    await this.delay(this.config.delayMs);

    const externalId = `sber_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Simulate Sberbank Online payment form URL
    const paymentUrl = `/mock/sberbank/payment-form/${payment.id}?externalId=${externalId}`;

    this.logger.log(`Generated Sberbank payment URL: ${paymentUrl}, externalId: ${externalId}`);

    return {
      paymentUrl,
      externalId,
    };
  }

  async getPaymentStatus(
    externalId: string,
  ): Promise<{ status: string; providerResponse: any }> {
    this.logger.log(`Checking Sberbank payment status for externalId: ${externalId}`);
    
    await this.delay(500); // Simulate API call delay
    
    // Simulate different payment statuses based on external ID pattern
    const isSuccess = Math.random() < this.config.successRate;
    const status = isSuccess ? 'completed' : 'failed';
    
    const providerResponse = {
      externalId,
      status,
      amount: 0, // Would be filled from actual API response
      currency: 'RUB',
      timestamp: new Date().toISOString(),
      provider: 'sberbank',
      mock: true,
      sberbankOrderId: `SB${Date.now()}`,
    };

    this.logger.log(`Sberbank payment status: ${status} for externalId: ${externalId}`);
    
    return { status, providerResponse };
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    this.logger.log(`Handling Sberbank webhook: ${JSON.stringify(data)}`);
    
    // Simulate Sberbank webhook format
    const { orderNumber, orderStatus, amount, currency } = data;
    
    // Map Sberbank statuses to internal statuses
    let status = 'pending';
    switch (orderStatus) {
      case 2: // Paid
        status = 'completed';
        break;
      case 3: // Cancelled
      case 4: // Refunded
        status = 'failed';
        break;
      case 1: // Registered
      default:
        status = 'pending';
        break;
    }

    this.logger.log(`Mapped Sberbank status ${orderStatus} to ${status} for order ${orderNumber}`);
    
    return { 
      externalId: orderNumber || data.externalId, 
      status 
    };
  }
}
