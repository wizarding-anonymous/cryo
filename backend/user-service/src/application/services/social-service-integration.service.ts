import { Injectable, Logger } from '@nestjs/common';
import { ISocialServiceIntegration } from '../../domain/interfaces/social-service.interface';
import { EventPublisher } from '../events/event-publisher.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class SocialServiceIntegrationService implements ISocialServiceIntegration {
  private readonly logger = new Logger(SocialServiceIntegrationService.name);

  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async notifyUserRegistered(eventData: {
    userId: string;
    email: string;
    username: string;
    registrationDate: Date;
    source: 'direct' | 'oauth';
    oauthProvider?: string;
    referralCode?: string;
  }): Promise<void> {
    try {
      await this.circuitBreaker.execute('social-service', async () => {
        await this.eventPublisher.publish('user.registered', {
          userId: eventData.userId,
          email: eventData.email,
          username: eventData.username,
          registrationDate: eventData.registrationDate.toISOString(),
          source: eventData.source,
          oauthProvider: eventData.oauthProvider,
          referralCode: eventData.referralCode,
          timestamp: new Date().toISOString(),
        });
      });

      this.logger.log(`Successfully notified Social Service about user registration: ${eventData.userId}`);
    } catch (error) {
      this.logger.error(`Failed to notify Social Service about user registration: ${eventData.userId}`, error.message);
      // Не бросаем ошибку, чтобы не блокировать регистрацию пользователя
    }
  }

  async notifyUserProfileUpdated(eventData: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    changedFields: string[];
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.circuitBreaker.execute('social-service', async () => {
        await this.eventPublisher.publish('user.profile.updated', {
          userId: eventData.userId,
          displayName: eventData.displayName,
          avatarUrl: eventData.avatarUrl,
          changedFields: eventData.changedFields,
          timestamp: eventData.timestamp.toISOString(),
        });
      });

      this.logger.log(`Successfully notified Social Service about profile update: ${eventData.userId}`);
    } catch (error) {
      this.logger.error(`Failed to notify Social Service about profile update: ${eventData.userId}`, error.message);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      // В реальной реализации здесь был бы HTTP запрос к Social Service
      // Пока что возвращаем true, так как Social Service еще не реализован
      return true;
    } catch (error) {
      this.logger.error('Social Service health check failed', error.message);
      return false;
    }
  }
}
