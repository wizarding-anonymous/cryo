import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient, ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';
import { LocalNotificationQueueService } from '../fallback/local-notification-queue.service';

export interface WelcomeNotificationRequest {
  userId: string;
  email: string;
  name?: string;
  language?: string;
}

export interface SecurityAlertNotificationRequest {
  userId: string;
  email: string;
  alertType: 'suspicious_login' | 'password_change' | 'account_locked' | 'multiple_failed_attempts' | 'suspicious_login_activity';
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  timestamp: Date;
}

export interface NotificationResponse {
  success: boolean;
  notificationId?: string;
  message?: string;
}

@Injectable()
export class NotificationServiceClient extends BaseCircuitBreakerClient {
  private readonly notificationQueue: any[] = [];
  private readonly maxQueueSize = 500;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor(
    httpService: HttpService,
    configService: ConfigService,
    circuitBreakerService: CircuitBreakerService,
    circuitBreakerConfig: CircuitBreakerConfig,
    private readonly localNotificationQueue: LocalNotificationQueueService,
  ) {
    super(
      httpService,
      configService,
      circuitBreakerService,
      'NotificationService',
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3007',
      circuitBreakerConfig.getNotificationServiceConfig(),
    );

    // Start retry mechanism for queued notifications
    this.startRetryMechanism();
  }

  /**
   * Send welcome email notification with enhanced fallback
   * Requirements: 6.4 - Send welcome notification via Notification Service
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   * Task 17.3: Enhanced fallback with local notification queue
   */
  async sendWelcomeNotification(request: WelcomeNotificationRequest): Promise<void> {
    try {
      const response = await this.post<NotificationResponse>('/notifications/welcome', {
        userId: request.userId,
        email: request.email,
        name: request.name || 'Пользователь',
        language: request.language || 'ru',
        timestamp: new Date(),
      });

      this.logger.log(`Welcome notification sent successfully: ${request.email} (ID: ${response.notificationId})`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Notification Service unavailable, using enhanced local queue: ${request.email}`);
        
        // Use enhanced local notification queue
        await this.localNotificationQueue.queueWelcomeNotification(request);
        this.queueNotification('welcome', request);
        return; // Don't throw error as this is not critical for auth flow
      }
      
      this.logger.error('Failed to send welcome notification', {
        error: error.message,
        stack: error.stack,
        userId: request.userId,
        email: request.email,
      });
      
      // Use local queue for any error
      await this.localNotificationQueue.queueWelcomeNotification(request);
      this.queueNotification('welcome', request);
      // Don't throw error as this is not critical for auth flow
    }
  }

  /**
   * Send security alert notification with enhanced fallback
   * Requirements: 6.5 - Send security alert notifications for suspicious activities
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   * Task 17.3: Enhanced fallback with prioritized local queue
   */
  private async sendSecurityAlertInternal(request: SecurityAlertNotificationRequest): Promise<void> {
    try {
      const response = await this.post<NotificationResponse>('/notifications/security-alert', {
        userId: request.userId,
        email: request.email,
        alertType: request.alertType,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        location: request.location,
        timestamp: request.timestamp,
      });

      this.logger.log(`Security alert sent successfully: ${request.email} (Type: ${request.alertType}, ID: ${response.notificationId})`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Notification Service unavailable, using enhanced local queue: ${request.email} (${request.alertType})`);
        
        // Use enhanced local notification queue with high priority for security alerts
        await this.localNotificationQueue.queueSecurityAlert(request);
        this.queueNotification('security_alert', request);
        return; // Don't throw error as this is not critical for auth flow
      }
      
      this.logger.error('Failed to send security alert notification', {
        error: error.message,
        stack: error.stack,
        userId: request.userId,
        email: request.email,
        alertType: request.alertType,
      });
      
      // Use local queue for any error with high priority
      await this.localNotificationQueue.queueSecurityAlert(request);
      this.queueNotification('security_alert', request);
      // Don't throw error as this is not critical for auth flow
    }
  }

  /**
   * Send login alert notification for new login
   * Requirements: 6.5 - Send security alert notifications for suspicious activities
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  async sendLoginAlert(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent?: string,
    location?: string
  ): Promise<void> {
    const request: SecurityAlertNotificationRequest = {
      userId,
      email,
      alertType: 'suspicious_login',
      ipAddress,
      userAgent,
      location,
      timestamp: new Date(),
    };

    await this.sendSecurityAlertInternal(request);
  }

  /**
   * Send password change notification
   * Requirements: 6.5 - Send security alert notifications for suspicious activities
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  async sendPasswordChangeAlert(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    const request: SecurityAlertNotificationRequest = {
      userId,
      email,
      alertType: 'password_change',
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };

    await this.sendSecurityAlertInternal(request);
  }

  /**
   * Send account locked notification
   * Requirements: 6.5 - Send security alert notifications for suspicious activities
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  async sendAccountLockedAlert(
    userId: string,
    email: string,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    const request: SecurityAlertNotificationRequest = {
      userId,
      email,
      alertType: 'account_locked',
      ipAddress,
      timestamp: new Date(),
    };

    // Log the reason for audit purposes
    this.logger.log(`Account locked alert for ${email}: ${reason}`);
    
    await this.sendSecurityAlertInternal(request);
  }

  /**
   * Send multiple failed attempts notification
   * Requirements: 6.5 - Send security alert notifications for suspicious activities
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  async sendMultipleFailedAttemptsAlert(
    email: string,
    attemptCount: number,
    ipAddress: string,
    userId?: string
  ): Promise<void> {
    const request: SecurityAlertNotificationRequest = {
      userId: userId || 'unknown',
      email,
      alertType: 'multiple_failed_attempts',
      ipAddress,
      timestamp: new Date(),
    };

    // Log the attempt count for audit purposes
    this.logger.log(`Multiple failed attempts alert for ${email}: ${attemptCount} attempts from ${ipAddress}`);

    await this.sendSecurityAlertInternal(request);
  }

  /**
   * Send security alert notification with custom alert type and metadata
   * Requirements: 11.3 - Add suspicious activity detection via events
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  async sendSecurityAlert(
    userId: string,
    email: string,
    alertType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const request: SecurityAlertNotificationRequest = {
      userId,
      email,
      alertType: alertType as any, // Cast to allow custom alert types
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      location: metadata?.location,
      timestamp: metadata?.timestamp || new Date(),
    };

    await this.sendSecurityAlertInternal(request);
  }

  /**
   * Queue notification for retry when service is unavailable
   * Requirement: 6.6 - Handle Notification Service unavailability gracefully
   */
  private queueNotification(type: string, data: any): void {
    if (this.notificationQueue.length >= this.maxQueueSize) {
      // Remove oldest notification to make room
      this.notificationQueue.shift();
      this.logger.warn('Notification queue full, removing oldest notification');
    }
    
    const queuedNotification = {
      type,
      data,
      queuedAt: new Date(),
      retryCount: 0,
    };
    
    this.notificationQueue.push(queuedNotification);
    this.logger.debug(`Queued ${type} notification for ${data.email}. Queue size: ${this.notificationQueue.length}`);
  }

  /**
   * Start retry mechanism for queued notifications
   * Requirement: 6.6 - Implement proper timeout and retry logic
   */
  private startRetryMechanism(): void {
    this.retryInterval = setInterval(async () => {
      if (this.notificationQueue.length === 0) {
        return;
      }

      // Don't retry if circuit breaker is open
      if (this.isCircuitBreakerOpen()) {
        this.logger.debug('Circuit breaker is open, skipping retry of queued notifications');
        return;
      }

      const notificationsToRetry = [...this.notificationQueue];
      this.notificationQueue.length = 0; // Clear the queue

      this.logger.log(`Retrying ${notificationsToRetry.length} queued notifications`);

      for (const notification of notificationsToRetry) {
        try {
          notification.retryCount++;
          
          switch (notification.type) {
            case 'welcome':
              await this.post<NotificationResponse>('/notifications/welcome', {
                ...notification.data,
                timestamp: new Date(),
              });
              break;
            case 'security_alert':
              await this.post<NotificationResponse>('/notifications/security-alert', {
                ...notification.data,
                timestamp: new Date(),
              });
              break;
            default:
              this.logger.warn(`Unknown notification type for retry: ${notification.type}`);
              continue;
          }
          
          this.logger.debug(`Successfully retried ${notification.type} notification for ${notification.data.email}`);
        } catch (error) {
          // Re-queue failed notifications with exponential backoff limit
          if (notification.retryCount < 5) {
            this.queueNotification(notification.type, notification.data);
            this.logger.debug(`Failed to retry ${notification.type} notification, re-queued (attempt ${notification.retryCount}): ${notification.data.email}`);
          } else {
            this.logger.error(`Permanently failed to send ${notification.type} notification after ${notification.retryCount} attempts: ${notification.data.email}`);
          }
        }
      }
    }, 45000); // Retry every 45 seconds (longer than Security Service to avoid overwhelming)
  }

  /**
   * Get notifications ready for retry from local queue
   * Task 17.3: Получение уведомлений готовых для повторной отправки
   */
  async getNotificationsReadyForRetry(limit: number = 20): Promise<any[]> {
    try {
      return this.localNotificationQueue.getNotificationsReadyForRetry(limit);
    } catch (error) {
      this.logger.error(`Failed to get notifications ready for retry: ${error.message}`);
      return [];
    }
  }

  /**
   * Process queued notifications (attempt to send them)
   * Task 17.3: Обработка очереди уведомлений
   */
  async processQueuedNotifications(): Promise<{ processed: number; failed: number }> {
    const notifications = await this.getNotificationsReadyForRetry(10);
    let processed = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        switch (notification.type) {
          case 'welcome':
            await this.post<NotificationResponse>('/notifications/welcome', {
              ...notification.data,
              timestamp: new Date(),
            });
            break;
          case 'security_alert':
            await this.post<NotificationResponse>('/notifications/security-alert', {
              ...notification.data,
              timestamp: new Date(),
            });
            break;
          default:
            this.logger.warn(`Unknown notification type for processing: ${notification.type}`);
            continue;
        }
        
        await this.localNotificationQueue.markNotificationAsSent(notification.id);
        processed++;
        
        this.logger.debug(`Successfully processed queued notification: ${notification.id}`);
      } catch (error) {
        await this.localNotificationQueue.markNotificationAsFailed(notification.id, error.message);
        failed++;
        
        this.logger.debug(`Failed to process queued notification: ${notification.id} - ${error.message}`);
      }
    }

    if (processed > 0 || failed > 0) {
      this.logger.log(`Processed queued notifications: ${processed} successful, ${failed} failed`);
    }

    return { processed, failed };
  }

  /**
   * Get local notification queue statistics
   * Task 17.3: Статистика локальной очереди уведомлений
   */
  getLocalQueueStats() {
    return this.localNotificationQueue.getQueueStats();
  }

  /**
   * Get queue statistics for monitoring
   */
  getQueueStats() {
    const localStats = this.getLocalQueueStats();
    
    return {
      queueSize: this.notificationQueue.length,
      maxQueueSize: this.maxQueueSize,
      circuitBreakerState: this.getCircuitBreakerState(),
      circuitBreakerStats: this.getCircuitBreakerStats(),
      localQueue: localStats,
    };
  }

  /**
   * Clear notification queue (for testing or manual intervention)
   */
  clearQueue(): void {
    this.notificationQueue.length = 0;
    this.logger.log('Notification queue cleared');
  }

  /**
   * Cleanup resources
   */
  onModuleDestroy(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }
}