import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserServiceClient } from './user.service.client';
import { NotificationServiceClient } from './notification.service.client';
import { AchievementServiceClient } from './achievement.service.client';
import { CircuitBreakerService } from './circuit-breaker.service';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class ExternalServicesHealthService {
  private readonly logger = new Logger(ExternalServicesHealthService.name);
  private readonly healthStatus = new Map<string, ServiceHealth>();

  constructor(
    private readonly userServiceClient: UserServiceClient,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly achievementServiceClient: AchievementServiceClient,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    // Initialize health status
    this.initializeHealthStatus();
  }

  /**
   * Run health checks every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing external services health checks');

    await Promise.allSettled([
      this.checkUserService(),
      this.checkNotificationService(),
      this.checkAchievementService(),
    ]);

    this.logHealthSummary();
  }

  /**
   * Get health status of all external services
   */
  getHealthStatus(): Record<string, ServiceHealth> {
    const status: Record<string, ServiceHealth> = {};
    for (const [name, health] of this.healthStatus.entries()) {
      status[name] = { ...health };
    }
    return status;
  }

  /**
   * Get health status of a specific service
   */
  getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.healthStatus.get(serviceName) || null;
  }

  /**
   * Check if all critical services are healthy
   */
  areAllServicesHealthy(): boolean {
    for (const [name, health] of this.healthStatus.entries()) {
      if (name === 'user-service' && health.status !== 'healthy') {
        return false; // User service is critical
      }
    }
    return true;
  }

  private initializeHealthStatus(): void {
    const services = ['user-service', 'notification-service', 'achievement-service'];

    for (const service of services) {
      this.healthStatus.set(service, {
        name: service,
        status: 'unknown',
        lastCheck: new Date(),
      });
    }
  }

  private async checkUserService(): Promise<void> {
    const startTime = Date.now();

    try {
      // Use circuit breaker for health check
      await this.circuitBreakerService.execute(
        'user-service-health',
        async () => {
          // Try to check if a dummy user exists (this should be fast)
          await this.userServiceClient.checkUserExists('health-check-dummy-id');
        },
        { failureThreshold: 3, resetTimeout: 30000 },
      );

      const responseTime = Date.now() - startTime;

      this.healthStatus.set('user-service', {
        name: 'user-service',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
      });

      this.logger.debug(`User service health check passed (${responseTime}ms)`);
    } catch (error) {
      this.healthStatus.set('user-service', {
        name: 'user-service',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: this.getErrorMessage(error),
      });

      this.logger.warn(`User service health check failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async checkNotificationService(): Promise<void> {
    const startTime = Date.now();

    try {
      // For notification service, we'll just check if the circuit is available
      // since we don't want to send actual notifications during health checks
      const isAvailable = this.circuitBreakerService.isAvailable('notification-service');

      if (isAvailable) {
        const responseTime = Date.now() - startTime;

        this.healthStatus.set('notification-service', {
          name: 'notification-service',
          status: 'healthy',
          lastCheck: new Date(),
          responseTime,
        });

        this.logger.debug(`Notification service health check passed (${responseTime}ms)`);
      } else {
        throw new Error('Circuit breaker is open');
      }
    } catch (error) {
      this.healthStatus.set('notification-service', {
        name: 'notification-service',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: this.getErrorMessage(error),
      });

      this.logger.warn(`Notification service health check failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async checkAchievementService(): Promise<void> {
    const startTime = Date.now();

    try {
      // Use circuit breaker for health check
      await this.circuitBreakerService.execute(
        'achievement-service-health',
        async () => {
          // Try to get achievements for a dummy user
          await this.achievementServiceClient.getUserAchievements('health-check-dummy-id');
        },
        { failureThreshold: 3, resetTimeout: 30000 },
      );

      const responseTime = Date.now() - startTime;

      this.healthStatus.set('achievement-service', {
        name: 'achievement-service',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
      });

      this.logger.debug(`Achievement service health check passed (${responseTime}ms)`);
    } catch (error) {
      this.healthStatus.set('achievement-service', {
        name: 'achievement-service',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: this.getErrorMessage(error),
      });

      this.logger.warn(`Achievement service health check failed: ${this.getErrorMessage(error)}`);
    }
  }

  private logHealthSummary(): void {
    const summary = Array.from(this.healthStatus.values())
      .map(
        (health) =>
          `${health.name}: ${health.status}${health.responseTime ? ` (${health.responseTime}ms)` : ''}`,
      )
      .join(', ');

    this.logger.log(`External services health: ${summary}`);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
