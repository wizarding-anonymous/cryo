import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaymentTransaction {
  transactionId: string;
  userId: string;
  gameId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface PaymentServiceResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.paymentServiceUrl = this.configService.get<string>(
      'PAYMENT_SERVICE_URL',
      'http://payment-service:3000',
    );
  }

  /**
   * Получение информации о транзакции
   */
  async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
    this.logger.log(`Getting transaction ${transactionId}`);

    try {
      const response = await fetch(`${this.paymentServiceUrl}/api/transactions/${transactionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Payment Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.transaction || null;
    } catch (error) {
      this.logger.error(`Failed to get transaction ${transactionId}:`, error);
      return null;
    }
  }

  /**
   * Получение истории покупок пользователя
   */
  async getUserTransactions(userId: string, limit = 50, offset = 0): Promise<PaymentTransaction[]> {
    this.logger.log(`Getting transactions for user ${userId} (limit: ${limit}, offset: ${offset})`);

    try {
      const response = await fetch(
        `${this.paymentServiceUrl}/api/users/${userId}/transactions?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Payment Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.transactions || [];
    } catch (error) {
      this.logger.error(`Failed to get transactions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Получение статистики покупок пользователя
   */
  async getUserPaymentStats(userId: string): Promise<{
    totalTransactions: number;
    totalSpent: number;
    firstPurchaseDate?: string;
    lastPurchaseDate?: string;
    averageTransactionAmount: number;
  } | null> {
    this.logger.log(`Getting payment stats for user ${userId}`);

    try {
      const response = await fetch(`${this.paymentServiceUrl}/api/users/${userId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Payment Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.stats || null;
    } catch (error) {
      this.logger.error(`Failed to get payment stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Проверка доступности Payment Service
   */
  async checkPaymentServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.paymentServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Payment Service health check failed:`, error);
      return false;
    }
  }

  /**
   * Проверка статуса транзакции для достижений
   */
  async isTransactionCompleted(transactionId: string): Promise<boolean> {
    const transaction = await this.getTransaction(transactionId);
    return transaction?.status === 'completed';
  }

  /**
   * Получение количества успешных покупок пользователя
   */
  async getUserCompletedTransactionsCount(userId: string): Promise<number> {
    try {
      const stats = await this.getUserPaymentStats(userId);
      return stats?.totalTransactions || 0;
    } catch (error) {
      this.logger.error(`Failed to get completed transactions count for user ${userId}:`, error);
      return 0;
    }
  }
}