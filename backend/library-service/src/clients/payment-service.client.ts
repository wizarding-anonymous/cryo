import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError } from 'rxjs';

@Injectable()
export class PaymentServiceClient {
  private readonly logger = new Logger(PaymentServiceClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl = this.configService.get<string>('services.payment.url');
    if (!configuredBaseUrl) {
      throw new Error('Payment service URL is not configured');
    }
    this.baseUrl = configuredBaseUrl;
  }

  /**
   * Fetch order status from Payment Service according to the integration map
   * GET /api/orders/:id
   */
  async getOrderStatus(orderId: string): Promise<{ status: string }> {
    const url = `${this.baseUrl}/orders/${orderId}`;

    const request$ = this.httpService.get<{ status: string }>(url).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to get order status for order ${orderId}: ${message}`);
        throw error;
      }),
    );

    const response = await firstValueFrom(request$);
    return response.data;
  }

  // Backward-compatible alias if other code uses the old name
  async getPaymentStatus(orderId: string): Promise<{ status: string }> {
    return this.getOrderStatus(orderId);
  }
}
