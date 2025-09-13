import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, of } from 'rxjs';

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
    this.baseUrl = this.configService.get('services.payment.url');
  }

  // Placeholder method as this client is not actively used by library-service
  async getPaymentStatus(orderId: string): Promise<{ status: string }> {
    const url = `${this.baseUrl}/orders/${orderId}/status`;

    const request$ = this.httpService.get<{ status: string }>(url).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => {
        this.logger.error(`Failed to get payment status for order ${orderId}: ${error.message}`);
        return of({ data: { status: 'unknown' } });
      }),
    );

    const response = await firstValueFrom(request$);
    return response.data;
  }
}
