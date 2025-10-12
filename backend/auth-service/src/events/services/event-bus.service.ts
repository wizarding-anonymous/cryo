import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  SecurityEventDto,
  NotificationEventDto,
  UserEventDto,
  UserRegisteredEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
} from '../dto';
import { AsyncOperationsService, Priority } from '../../common/async/async-operations.service';
import { AsyncMetricsService } from '../../common/async/async-metrics.service';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue('security-events') private securityQueue: Queue,
    @InjectQueue('notification-events') private notificationQueue: Queue,
    @InjectQueue('user-events') private userQueue: Queue,
    private readonly asyncOperations: AsyncOperationsService,
    private readonly metricsService: AsyncMetricsService,
  ) {
    this.setupAsyncOperations();
  }

  /**
   * Publish security event for audit logging (optimized with async operations)
   */
  async publishSecurityEvent(event: SecurityEventDto): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use setImmediate for non-blocking execution
      this.asyncOperations.executeImmediate(async () => {
        const queueStartTime = Date.now();
        
        await this.securityQueue.add('log-security-event', event, {
          priority: this.getSecurityEventPriority(event.type),
          delay: 0,
        });

        const queueTime = Date.now() - queueStartTime;
        const totalTime = Date.now() - startTime;

        // Record metrics
        this.metricsService.recordEventMetric(
          `security_${event.type}`,
          totalTime,
          true,
          queueTime
        );

        this.logger.debug(`Security event published: ${event.type} for user ${event.userId}`, {
          queueTime,
          totalTime,
          priority: this.getSecurityEventPriority(event.type),
        });
      }, this.getAsyncPriority(event.type));

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        `security_${event.type}`,
        totalTime,
        false
      );

      this.logger.error(`Failed to publish security event: ${error.message}`, {
        eventType: event.type,
        userId: event.userId,
        error: error.stack,
        totalTime,
      });
      // Don't throw - security logging should not break main flow
    }
  }

  /**
   * Publish notification event for user notifications (optimized with async operations)
   */
  async publishNotificationEvent(event: NotificationEventDto): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use setImmediate for non-blocking execution with delay handling
      this.asyncOperations.executeImmediate(async () => {
        const delay = this.getNotificationDelay(event.type);
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const queueStartTime = Date.now();
        
        await this.notificationQueue.add('send-notification', event, {
          priority: this.getNotificationEventPriority(event.type),
          delay: 0, // Delay handled above
        });

        const queueTime = Date.now() - queueStartTime;
        const totalTime = Date.now() - startTime;

        // Record metrics
        this.metricsService.recordEventMetric(
          `notification_${event.type}`,
          totalTime,
          true,
          queueTime
        );

        this.logger.debug(`Notification event published: ${event.type} for user ${event.userId}`, {
          queueTime,
          totalTime,
          delay,
          priority: this.getNotificationEventPriority(event.type),
        });
      }, this.getAsyncPriority(event.type));

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        `notification_${event.type}`,
        totalTime,
        false
      );

      this.logger.error(`Failed to publish notification event: ${error.message}`, {
        eventType: event.type,
        userId: event.userId,
        error: error.stack,
        totalTime,
      });
      // Don't throw - notification should not break main flow
    }
  }

  /**
   * Publish user event for user data updates (optimized with async operations)
   */
  async publishUserEvent(event: UserEventDto): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use setImmediate for non-blocking execution
      this.asyncOperations.executeImmediate(async () => {
        const queueStartTime = Date.now();
        
        await this.userQueue.add('update-user-data', event, {
          priority: this.getUserEventPriority(event.type),
          delay: 0,
        });

        const queueTime = Date.now() - queueStartTime;
        const totalTime = Date.now() - startTime;

        // Record metrics
        this.metricsService.recordEventMetric(
          `user_${event.type}`,
          totalTime,
          true,
          queueTime
        );

        this.logger.debug(`User event published: ${event.type} for user ${event.userId}`, {
          queueTime,
          totalTime,
          priority: this.getUserEventPriority(event.type),
        });
      }, this.getAsyncPriority(event.type));

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        `user_${event.type}`,
        totalTime,
        false
      );

      this.logger.error(`Failed to publish user event: ${error.message}`, {
        eventType: event.type,
        userId: event.userId,
        error: error.stack,
        totalTime,
      });
      // Don't throw - user updates should not break main flow
    }
  }

  /**
   * Publish user registration event (combines multiple events with parallel execution)
   */
  async publishUserRegisteredEvent(event: UserRegisteredEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Execute events in parallel for better performance
      const operations = [
        () => this.publishSecurityEvent(new SecurityEventDto({
          userId: event.userId,
          type: 'registration',
          ipAddress: event.ipAddress,
          metadata: {
            email: event.email,
            name: event.name,
          },
          timestamp: event.timestamp,
        })),
        () => this.publishNotificationEvent(new NotificationEventDto({
          userId: event.userId,
          email: event.email,
          type: 'welcome',
          data: {
            name: event.name,
          },
          timestamp: event.timestamp,
        })),
      ];

      // Execute in parallel with concurrency control
      await this.asyncOperations.executeParallel(operations, 2, Priority.HIGH);

      const totalTime = Date.now() - startTime;
      this.metricsService.recordEventMetric(
        'user_registration_combined',
        totalTime,
        true
      );

      this.logger.debug('User registration events published', {
        userId: event.userId,
        email: event.email,
        totalTime,
        eventsCount: operations.length,
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        'user_registration_combined',
        totalTime,
        false
      );

      this.logger.error('Failed to publish user registration events', {
        userId: event.userId,
        email: event.email,
        error: error.message,
        totalTime,
      });
      // Don't throw - event publishing should not break main flow
    }
  }

  /**
   * Publish user login event (combines multiple events with parallel execution)
   */
  async publishUserLoggedInEvent(event: UserLoggedInEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Execute events in parallel for better performance
      const operations = [
        () => this.publishSecurityEvent(new SecurityEventDto({
          userId: event.userId,
          type: 'login',
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            sessionId: event.sessionId,
          },
          timestamp: event.timestamp,
        })),
        () => this.publishUserEvent(new UserEventDto({
          userId: event.userId,
          type: 'update_last_login',
          data: {
            lastLoginAt: event.timestamp,
            ipAddress: event.ipAddress,
          },
          timestamp: event.timestamp,
        })),
      ];

      // Execute in parallel with concurrency control
      await this.asyncOperations.executeParallel(operations, 2, Priority.HIGH);

      const totalTime = Date.now() - startTime;
      this.metricsService.recordEventMetric(
        'user_login_combined',
        totalTime,
        true
      );

      this.logger.debug('User login events published', {
        userId: event.userId,
        sessionId: event.sessionId,
        totalTime,
        eventsCount: operations.length,
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        'user_login_combined',
        totalTime,
        false
      );

      this.logger.error('Failed to publish user login events', {
        userId: event.userId,
        sessionId: event.sessionId,
        error: error.message,
        totalTime,
      });
      // Don't throw - event publishing should not break main flow
    }
  }

  /**
   * Publish user logout event (optimized with async operations)
   */
  async publishUserLoggedOutEvent(event: UserLoggedOutEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use setImmediate for non-blocking execution
      this.asyncOperations.executeImmediate(async () => {
        await this.publishSecurityEvent(new SecurityEventDto({
          userId: event.userId,
          type: 'logout',
          ipAddress: event.ipAddress,
          metadata: {
            sessionId: event.sessionId,
            reason: event.reason,
          },
          timestamp: event.timestamp,
        }));

        const totalTime = Date.now() - startTime;
        this.metricsService.recordEventMetric(
          'user_logout',
          totalTime,
          true
        );

        this.logger.debug('User logout event published', {
          userId: event.userId,
          sessionId: event.sessionId,
          reason: event.reason,
          totalTime,
        });
      }, Priority.HIGH);

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        'user_logout',
        totalTime,
        false
      );

      this.logger.error('Failed to publish user logout event', {
        userId: event.userId,
        sessionId: event.sessionId,
        error: error.message,
        totalTime,
      });
      // Don't throw - event publishing should not break main flow
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats(): Promise<{
    security: any;
    notification: any;
    user: any;
  }> {
    const [securityStats, notificationStats, userStats] = await Promise.all([
      this.getQueueInfo(this.securityQueue),
      this.getQueueInfo(this.notificationQueue),
      this.getQueueInfo(this.userQueue),
    ]);

    return {
      security: securityStats,
      notification: notificationStats,
      user: userStats,
    };
  }

  private async getQueueInfo(queue: Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  private getSecurityEventPriority(type: string): number {
    switch (type) {
      case 'suspicious_activity':
        return 1; // Highest priority
      case 'brute_force_attack':
        return 1; // Highest priority
      case 'failed_login':
        return 2;
      case 'all_sessions_invalidated':
      case 'security_session_invalidation':
        return 2; // High priority for security actions
      case 'login':
      case 'logout':
        return 3;
      case 'registration':
        return 4;
      default:
        return 5; // Lowest priority
    }
  }

  private getNotificationEventPriority(type: string): number {
    switch (type) {
      case 'security_alert':
        return 1; // Highest priority
      case 'password_reset':
        return 2;
      case 'login_alert':
        return 3;
      case 'welcome':
        return 4;
      default:
        return 5; // Lowest priority
    }
  }

  private getUserEventPriority(type: string): number {
    switch (type) {
      case 'account_status_change':
        return 1; // Highest priority
      case 'update_last_login':
        return 2;
      case 'profile_update':
        return 3;
      default:
        return 4; // Lowest priority
    }
  }

  private getNotificationDelay(type: string): number {
    switch (type) {
      case 'security_alert':
        return 0; // Immediate
      case 'password_reset':
        return 1000; // 1 second delay
      case 'login_alert':
        return 2000; // 2 second delay
      case 'welcome':
        return 5000; // 5 second delay to ensure user creation is complete
      default:
        return 0;
    }
  }

  /**
   * Setup async operations for event processing
   */
  private setupAsyncOperations(): void {
    // Register security event operation
    this.asyncOperations.registerOperation('security-event', async (payload) => {
      const { event, queueOptions } = payload;
      return await this.securityQueue.add('log-security-event', event, queueOptions);
    });

    // Register notification event operation
    this.asyncOperations.registerOperation('notification-event', async (payload) => {
      const { event, queueOptions } = payload;
      return await this.notificationQueue.add('send-notification', event, queueOptions);
    });

    // Register user event operation
    this.asyncOperations.registerOperation('user-event', async (payload) => {
      const { event, queueOptions } = payload;
      return await this.userQueue.add('update-user-data', event, queueOptions);
    });

    this.logger.log('Async operations registered for event processing');
  }

  /**
   * Get async priority based on event type
   */
  private getAsyncPriority(eventType: string): Priority {
    switch (eventType) {
      case 'suspicious_activity':
      case 'brute_force_attack':
      case 'security_alert':
        return Priority.HIGH;
      case 'failed_login':
      case 'login':
      case 'logout':
      case 'password_reset':
        return Priority.NORMAL;
      case 'registration':
      case 'welcome':
      case 'profile_update':
        return Priority.LOW;
      default:
        return Priority.NORMAL;
    }
  }

  /**
   * Publish events in batch for efficiency
   */
  async publishEventsBatch(events: Array<{
    type: 'security' | 'notification' | 'user';
    data: SecurityEventDto | NotificationEventDto | UserEventDto;
  }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const operations = events.map(({ type, data }) => {
        switch (type) {
          case 'security':
            return () => this.publishSecurityEvent(data as SecurityEventDto);
          case 'notification':
            return () => this.publishNotificationEvent(data as NotificationEventDto);
          case 'user':
            return () => this.publishUserEvent(data as UserEventDto);
          default:
            throw new Error(`Unknown event type: ${type}`);
        }
      });

      // Execute in batches for efficiency
      await this.asyncOperations.executeBatch(operations, 10, Priority.NORMAL);

      const totalTime = Date.now() - startTime;
      this.metricsService.recordEventMetric(
        'events_batch',
        totalTime,
        true
      );

      this.logger.debug('Event batch published', {
        eventsCount: events.length,
        totalTime,
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.metricsService.recordEventMetric(
        'events_batch',
        totalTime,
        false
      );

      this.logger.error('Failed to publish event batch', {
        eventsCount: events.length,
        error: error.message,
        totalTime,
      });
      throw error;
    }
  }

  /**
   * Get event processing metrics
   */
  getEventMetrics(): {
    queueStats: any;
    asyncMetrics: any;
    performanceSummary: any;
  } {
    return {
      queueStats: this.getQueueStats(),
      asyncMetrics: this.asyncOperations.getMetrics(),
      performanceSummary: this.metricsService.getPerformanceSummary(),
    };
  }

  /**
   * Health check for event processing
   */
  async getEventHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const queueStats = await this.getQueueStats();
    const healthStatus = this.metricsService.getHealthStatus();
    
    // Check queue health
    const totalWaiting = queueStats.security.waiting + 
                        queueStats.notification.waiting + 
                        queueStats.user.waiting;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = healthStatus.status;
    const issues = [...healthStatus.issues];

    if (totalWaiting > 1000) {
      issues.push('High queue backlog');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    const totalFailed = queueStats.security.failed + 
                       queueStats.notification.failed + 
                       queueStats.user.failed;
    
    if (totalFailed > 100) {
      issues.push('High failure rate in event processing');
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        issues,
        queueStats,
        metrics: healthStatus.metrics,
      },
    };
  }

  /**
   * Graceful shutdown of event processing
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down event bus service');
    await this.asyncOperations.shutdown();
  }
}