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

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue('security-events') private securityQueue: Queue,
    @InjectQueue('notification-events') private notificationQueue: Queue,
    @InjectQueue('user-events') private userQueue: Queue,
  ) {}

  /**
   * Publish security event for audit logging
   */
  async publishSecurityEvent(event: SecurityEventDto): Promise<void> {
    try {
      await this.securityQueue.add('log-security-event', event, {
        priority: this.getSecurityEventPriority(event.type),
        delay: 0,
      });
      
      this.logger.log(`Security event published: ${event.type} for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to publish security event: ${error.message}`, error.stack);
      // Don't throw - security logging should not break main flow
    }
  }

  /**
   * Publish notification event for user notifications
   */
  async publishNotificationEvent(event: NotificationEventDto): Promise<void> {
    try {
      await this.notificationQueue.add('send-notification', event, {
        priority: this.getNotificationEventPriority(event.type),
        delay: this.getNotificationDelay(event.type),
      });
      
      this.logger.log(`Notification event published: ${event.type} for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to publish notification event: ${error.message}`, error.stack);
      // Don't throw - notification should not break main flow
    }
  }

  /**
   * Publish user event for user data updates
   */
  async publishUserEvent(event: UserEventDto): Promise<void> {
    try {
      await this.userQueue.add('update-user-data', event, {
        priority: this.getUserEventPriority(event.type),
        delay: 0,
      });
      
      this.logger.log(`User event published: ${event.type} for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to publish user event: ${error.message}`, error.stack);
      // Don't throw - user updates should not break main flow
    }
  }

  /**
   * Publish user registration event (combines multiple events)
   */
  async publishUserRegisteredEvent(event: UserRegisteredEvent): Promise<void> {
    // Publish security event
    await this.publishSecurityEvent(new SecurityEventDto({
      userId: event.userId,
      type: 'registration',
      ipAddress: event.ipAddress,
      metadata: {
        email: event.email,
        name: event.name,
      },
      timestamp: event.timestamp,
    }));

    // Publish notification event for welcome email
    await this.publishNotificationEvent(new NotificationEventDto({
      userId: event.userId,
      email: event.email,
      type: 'welcome',
      data: {
        name: event.name,
      },
      timestamp: event.timestamp,
    }));
  }

  /**
   * Publish user login event (combines multiple events)
   */
  async publishUserLoggedInEvent(event: UserLoggedInEvent): Promise<void> {
    // Publish security event
    await this.publishSecurityEvent(new SecurityEventDto({
      userId: event.userId,
      type: 'login',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        sessionId: event.sessionId,
      },
      timestamp: event.timestamp,
    }));

    // Publish user event to update last login
    await this.publishUserEvent(new UserEventDto({
      userId: event.userId,
      type: 'update_last_login',
      data: {
        lastLoginAt: event.timestamp,
        ipAddress: event.ipAddress,
      },
      timestamp: event.timestamp,
    }));
  }

  /**
   * Publish user logout event
   */
  async publishUserLoggedOutEvent(event: UserLoggedOutEvent): Promise<void> {
    // Publish security event
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
}