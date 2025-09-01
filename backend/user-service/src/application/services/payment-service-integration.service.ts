import { Injectable, Logger } from '@nestjs/common';
import { IPaymentServiceIntegration } from '../../domain/interfaces/payment-service.interface';
import { EventPublisher } from '../events/event-publisher.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class PaymentServiceIntegrationService implements IPaymentServiceIntegration {
  private readonly logger = new Logger(PaymentServiceIntegrationService.name);

  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async notifyUserBlocked(eventData: {
    userId: string;
    reason: string;
    blockedBy: string;
    duration?: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.circuitBreaker.execute('payment-service', async () => {
        await this.eventPublisher.publish('user.blocked', {
          userId: eventData.userId,
          reason: eventData.reason,
          blockedBy: eventData.blockedBy,
          duration: eventData.duration,
          timestamp: eventData.timestamp.toISOString(),
        });
      });

      this.logger.log(`Successfully notified Payment Service about user block: ${eventData.userId}`);
    } catch (error) {
      this.logger.error(`Failed to notify Payment Service about user block: ${eventData.userId}`, error.message);
      // Не бросаем ошибку, чтобы не блокировать административные действия
    }
  }

  async notifyUserUnblocked(eventData: { userId: string; unblockedBy: string; timestamp: Date }): Promise<void> {
    try {
      await this.circuitBreaker.execute('payment-service', async () => {
        await this.eventPublisher.publish('user.unblocked', {
          userId: eventData.userId,
          unblockedBy: eventData.unblockedBy,
          timestamp: eventData.timestamp.toISOString(),
        });
      });

      this.logger.log(`Successfully notified Payment Service about user unblock: ${eventData.userId}`);
    } catch (error) {
      this.logger.error(`Failed to notify Payment Service about user unblock: ${eventData.userId}`, error.message);
    }
  }

  async checkUserStatus(userId: string): Promise<{
    canMakePayments: boolean;
    canReceivePayments: boolean;
    restrictions: string[];
  }> {
    try {
      // В реальной реализации здесь был бы HTTP запрос к Payment Service
      // Пока что возвращаем базовые разрешения, так как Payment Service еще не реализован
      return {
        canMakePayments: true,
        canReceivePayments: true,
        restrictions: [],
      };
    } catch (error) {
      this.logger.error(`Failed to check user status in Payment Service: ${userId}`, error.message);
      // В случае ошибки возвращаем ограниченные права
      return {
        canMakePayments: false,
        canReceivePayments: false,
        restrictions: ['service_unavailable'],
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      // В реальной реализации здесь был бы HTTP запрос к Payment Service
      // Пока что возвращаем true, так как Payment Service еще не реализован
      return true;
    } catch (error) {
      this.logger.error('Payment Service health check failed', error.message);
      return false;
    }
  }
}
