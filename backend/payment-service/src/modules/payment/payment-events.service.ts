import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

export interface PaymentCompletedEvent {
  paymentId: string;
  orderId: string;
  userId: string;
  gameId: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  completedAt: string;
  externalId?: string | null;
}

@Injectable()
export class PaymentEventsService {
  private readonly logger = new Logger(PaymentEventsService.name);
  private readonly eventBusUrl: string | undefined;
  private readonly purchaseEventName: string;
  private readonly publishTimeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.eventBusUrl = this.configService.get<string>('EVENT_BUS_URL');
    this.purchaseEventName =
      this.configService.get<string>('PURCHASE_COMPLETED_EVENT_NAME') ||
      'payment.purchase.completed';
    this.publishTimeout =
      this.configService.get<number>('EVENT_BUS_TIMEOUT_MS') || 3000;
  }

  async publishPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (!this.eventBusUrl) {
      this.logger.warn(
        'EVENT_BUS_URL is not configured. Skipping payment completed event publication.',
      );
      return;
    }

    try {
      await firstValueFrom(
        this.httpService
          .post(
            this.eventBusUrl,
            {
              event: this.purchaseEventName,
              payload: event,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            timeout(this.publishTimeout),
            catchError((error) => {
              this.logger.error(
                'Failed to publish payment completed event for payment ' +
                  event.paymentId +
                  ': ' +
                  error.message,
                error.stack,
              );
              return of(null);
            }),
          ),
      );
      this.logger.log(
        'Published payment completed event for payment ' + event.paymentId,
      );
    } catch (error) {
      this.logger.error(
        'Unhandled error while publishing payment completed event for payment ' +
          event.paymentId +
          ': ' +
          error.message,
        error.stack,
      );
    }
  }
}
