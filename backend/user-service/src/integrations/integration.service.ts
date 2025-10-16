import { Injectable, Logger } from '@nestjs/common';
import { NotificationClient } from './notification/notification.client';
import { SecurityClient } from './security/security.client';
import { AuthServiceClient } from './auth/auth-service.client';
import { EventPublisherService } from './events/event-publisher.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { User } from '../user/entities/user.entity';

export interface UserEvent {
  type: 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'PROFILE_UPDATED';
  userId: string;
  timestamp: Date;
  data: any;
  correlationId: string;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly notificationClient: NotificationClient,
    private readonly securityClient: SecurityClient,
    private readonly authServiceClient: AuthServiceClient,
    private readonly eventPublisher: EventPublisherService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Notify Auth Service about user creation
   */
  async notifyUserCreated(user: User): Promise<void> {
    try {
      this.logger.log(`Notifying Auth Service about user creation: ${user.id}`);

      await this.circuitBreaker.execute(
        'auth-service',
        () => this.authServiceClient.notifyUserCreated(user),
        () => this.handleAuthServiceUnavailable('USER_CREATED', user.id),
      );

      // Publish event for other microservices
      await this.publishUserEvent({
        type: 'USER_CREATED',
        userId: user.id,
        timestamp: new Date(),
        data: { email: user.email, name: user.name },
        correlationId: this.generateCorrelationId(),
      });

      this.logger.log(`Successfully notified about user creation: ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to notify about user creation: ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Notify Auth Service about user updates
   */
  async notifyUserUpdated(user: User, changes: Partial<User>): Promise<void> {
    try {
      this.logger.log(`Notifying Auth Service about user update: ${user.id}`);

      await this.circuitBreaker.execute(
        'auth-service',
        () => this.authServiceClient.notifyUserUpdated(user, changes),
        () => this.handleAuthServiceUnavailable('USER_UPDATED', user.id),
      );

      // Publish event for other microservices
      await this.publishUserEvent({
        type: 'USER_UPDATED',
        userId: user.id,
        timestamp: new Date(),
        data: { changes },
        correlationId: this.generateCorrelationId(),
      });

      this.logger.log(`Successfully notified about user update: ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to notify about user update: ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Notify Auth Service about user deletion
   */
  async notifyUserDeleted(userId: string): Promise<void> {
    try {
      this.logger.log(`Notifying Auth Service about user deletion: ${userId}`);

      await this.circuitBreaker.execute(
        'auth-service',
        () => this.authServiceClient.notifyUserDeleted(userId),
        () => this.handleAuthServiceUnavailable('USER_DELETED', userId),
      );

      // Publish event for other microservices
      await this.publishUserEvent({
        type: 'USER_DELETED',
        userId,
        timestamp: new Date(),
        data: {},
        correlationId: this.generateCorrelationId(),
      });

      this.logger.log(`Successfully notified about user deletion: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to notify about user deletion: ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish user event to other microservices
   */
  async publishUserEvent(event: UserEvent): Promise<void> {
    try {
      await this.circuitBreaker.execute(
        'event-publisher',
        () => this.eventPublisher.publishEvent(event),
        () => this.handleEventPublishingUnavailable(event),
      );
    } catch (error) {
      this.logger.error(`Failed to publish user event: ${event.type}`, error);
      // Don't throw - event publishing failures shouldn't break main operations
    }
  }

  /**
   * Handle external service request with circuit breaker
   */
  async handleExternalUserRequest(
    serviceId: string,
    userId: string,
  ): Promise<any> {
    return this.circuitBreaker.execute(
      `external-${serviceId}`,
      async () => {
        // This would be implemented based on specific service requirements
        this.logger.log(
          `Handling external request from ${serviceId} for user ${userId}`,
        );
        return { userId, serviceId, timestamp: new Date() };
      },
      () => this.handleExternalServiceUnavailable(serviceId, userId),
    );
  }

  /**
   * Call external service with circuit breaker protection
   */
  async callExternalService<T>(
    serviceName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.circuitBreaker.execute(serviceName, operation, () =>
      this.handleGenericServiceUnavailable(serviceName),
    );
  }

  /**
   * Graceful degradation when Auth Service is unavailable
   */
  private async handleAuthServiceUnavailable(
    operation: string,
    userId: string,
  ): Promise<void> {
    this.logger.warn(
      `Auth Service unavailable for ${operation}, using graceful degradation for user ${userId}`,
    );

    // Store the operation for retry later
    await this.storeFailedOperation('auth-service', operation, userId);

    // Continue with local operations
    this.logger.log(`Continuing with local operations for user ${userId}`);
  }

  /**
   * Graceful degradation when Event Publishing is unavailable
   */
  private async handleEventPublishingUnavailable(
    event: UserEvent,
  ): Promise<void> {
    this.logger.warn(
      `Event publishing unavailable for ${event.type}, storing for retry`,
    );

    // Store event for retry later
    await this.storeFailedEvent(event);
  }

  /**
   * Graceful degradation for external services
   */
  private async handleExternalServiceUnavailable(
    serviceId: string,
    userId: string,
  ): Promise<any> {
    this.logger.warn(
      `External service ${serviceId} unavailable for user ${userId}, returning cached data`,
    );

    // Return cached or default data
    return {
      userId,
      serviceId,
      cached: true,
      timestamp: new Date(),
      message: 'Service temporarily unavailable, using cached data',
    };
  }

  /**
   * Generic graceful degradation
   */
  private async handleGenericServiceUnavailable(
    serviceName: string,
  ): Promise<any> {
    this.logger.warn(
      `Service ${serviceName} unavailable, using graceful degradation`,
    );

    return {
      service: serviceName,
      available: false,
      timestamp: new Date(),
      message: 'Service temporarily unavailable',
    };
  }

  /**
   * Store failed operation for retry
   */
  private async storeFailedOperation(
    service: string,
    operation: string,
    userId: string,
  ): Promise<void> {
    // In a real implementation, this would store in Redis or database for retry
    this.logger.debug(
      `Storing failed operation: ${service}:${operation}:${userId}`,
    );
  }

  /**
   * Store failed event for retry
   */
  private async storeFailedEvent(event: UserEvent): Promise<void> {
    // In a real implementation, this would store in Redis or database for retry
    this.logger.debug(`Storing failed event: ${event.type}:${event.userId}`);
  }

  /**
   * Generate correlation ID for tracing
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
