import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, timer } from 'rxjs';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface PaymentOrder {
  id: string;
  userId: string;
  gameId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentServiceClient {
  private readonly logger = new Logger(PaymentServiceClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

  // Circuit Breaker configuration
  private readonly circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 60 seconds
  private readonly halfOpenMaxCalls = 3;
  private halfOpenCalls = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl = this.configService.get<string>(
      'services.payment.url',
    );
    if (!configuredBaseUrl) {
      throw new Error('Payment service URL is not configured');
    }
    this.baseUrl = configuredBaseUrl;
  }

  private checkCircuitBreaker(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'OPEN':
        if (now - this.circuitBreaker.lastFailureTime > this.recoveryTimeout) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.halfOpenCalls = 0;
          this.logger.log('Circuit breaker moved to HALF_OPEN state');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return this.halfOpenCalls < this.halfOpenMaxCalls;

      case 'CLOSED':
      default:
        return true;
    }
  }

  private onSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      this.logger.log('Circuit breaker moved to CLOSED state');
    } else if (this.circuitBreaker.state === 'CLOSED') {
      this.circuitBreaker.failures = 0;
    }
  }

  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn('Circuit breaker moved to OPEN state from HALF_OPEN');
    } else if (this.circuitBreaker.failures >= this.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn(
        `Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`,
      );
    }
  }

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.checkCircuitBreaker()) {
      const error = new Error(
        'Circuit breaker is OPEN - Payment service unavailable',
      );
      this.logger.warn('Request blocked by circuit breaker');
      throw error;
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Fetch order status from Payment Service according to the integration map
   * GET /api/orders/:id
   */
  async getOrderStatus(orderId: string): Promise<{ status: string }> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/orders/${orderId}`;

      const request$ = this.httpService.get<{ status: string }>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for getOrderStatus: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to get order status for order ${orderId}: ${message}`,
          );
          throw error;
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }

  /**
   * Get full order details from Payment Service
   * GET /api/orders/:id/details
   */
  async getOrderDetails(orderId: string): Promise<PaymentOrder> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/orders/${orderId}/details`;

      const request$ = this.httpService.get<PaymentOrder>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for getOrderDetails: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to get order details for order ${orderId}: ${message}`,
          );
          throw error;
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }

  /**
   * Verify payment completion for a specific order
   * GET /api/orders/:id/verify
   */
  async verifyPayment(
    orderId: string,
  ): Promise<{ verified: boolean; transactionId?: string }> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/orders/${orderId}/verify`;

      const request$ = this.httpService
        .get<{ verified: boolean; transactionId?: string }>(url)
        .pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              this.logger.warn(
                `Retry attempt ${retryCount} for verifyPayment: ${error.message}`,
              );
              return timer(this.retryDelay * retryCount);
            },
          }),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to verify payment for order ${orderId}: ${message}`,
            );
            throw error;
          }),
        );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }

  // Backward-compatible alias if other code uses the old name
  async getPaymentStatus(orderId: string): Promise<{ status: string }> {
    return this.getOrderStatus(orderId);
  }
}
