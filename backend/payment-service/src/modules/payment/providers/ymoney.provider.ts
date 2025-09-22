import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../entities/payment.entity';
import {
  PaymentProviderInterface,
  ProcessPaymentResponse,
} from '../interfaces/payment-provider.interface';
import { SimulationConfig } from '../payment-provider.factory';

@Injectable()
export class YMoneyMockProvider implements PaymentProviderInterface {
  private readonly logger = new Logger(YMoneyMockProvider.name);

  constructor(private readonly config: SimulationConfig) {}

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    this.logger.log(`Processing YMoney payment for order ${payment.orderId}, amount: ${payment.amount} RUB`);
    
    await this.delay(this.config.delayMs);

    const externalId = `ym_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Simulate YMoney payment form URL
    const paymentUrl = `/mock/ymoney/payment-form/${payment.id}?externalId=${externalId}`;

    this.logger.log(`Generated YMoney payment URL: ${paymentUrl}, externalId: ${externalId}`);

    return {
      paymentUrl,
      externalId,
    };
  }

  async getPaymentStatus(
    externalId: string,
  ): Promise<{ status: string; providerResponse: any }> {
    this.logger.log(`Checking YMoney payment status for externalId: ${externalId}`);
    
    await this.delay(300); // Simulate API call delay
    
    const isSuccess = Math.random() < this.config.successRate;
    const status = isSuccess ? 'completed' : 'failed';
    
    const providerResponse = {
      externalId,
      status,
      amount: 0, // Would be filled from actual API response
      currency: 'RUB',
      timestamp: new Date().toISOString(),
      provider: 'ymoney',
      mock: true,
      ymoneyOperationId: `YM${Date.now()}`,
      paymentMethod: 'wallet', // Could be 'wallet', 'card', 'sberbank', etc.
    };

    this.logger.log(`YMoney payment status: ${status} for externalId: ${externalId}`);
    
    return { status, providerResponse };
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    this.logger.log(`Handling YMoney webhook: ${JSON.stringify(data)}`);
    
    // Simulate YMoney webhook format
    const { operation_id, status: ymoneyStatus, amount, currency } = data;
    
    // Map YMoney statuses to internal statuses
    let status = 'pending';
    switch (ymoneyStatus) {
      case 'success':
        status = 'completed';
        break;
      case 'refused':
      case 'canceled':
        status = 'failed';
        break;
      case 'in_progress':
      default:
        status = 'pending';
        break;
    }

    this.logger.log(`Mapped YMoney status ${ymoneyStatus} to ${status} for operation ${operation_id}`);
    
    return { 
      externalId: operation_id || data.externalId, 
      status 
    };
  }
}
