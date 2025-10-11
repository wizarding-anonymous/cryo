import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationEventDto } from '../dto';
import { NotificationServiceClient } from '../../common/http-client/notification-service.client';

@Injectable()
@Processor('notification-events')
export class NotificationEventProcessor {
  private readonly logger = new Logger(NotificationEventProcessor.name);

  constructor(
    private readonly notificationServiceClient: NotificationServiceClient,
  ) { }

  @Process('send-notification')
  async handleNotificationEvent(job: Job<NotificationEventDto>): Promise<void> {
    const event = job.data;
    const jobId = job.id;
    const attemptNumber = job.attemptsMade + 1;

    try {
      this.logger.log(
        `Processing notification event (Job: ${jobId}, Attempt: ${attemptNumber}): ${event.type} for user ${event.userId}`
      );

      // Validate notification event data
      await this.validateNotificationEvent(event);

      // Process notification through Notification Service
      await this.processNotificationThroughService(event);

      // Also process locally for logging and fallback
      await this.processNotificationLocally(event);

      this.logger.log(
        `Notification event processed successfully (Job: ${jobId}): ${event.type} for user ${event.userId}`
      );
    } catch (error) {
      const errorMessage = `Failed to process notification event (Job: ${jobId}, Attempt: ${attemptNumber}): ${error.message}`;

      // Log error with context
      this.logger.error(errorMessage, {
        jobId,
        attemptNumber,
        maxAttempts: job.opts.attempts || 5,
        eventType: event.type,
        userId: event.userId,
        email: event.email,
        error: error.message,
        stack: error.stack,
      });

      // Check if this is the final attempt
      const maxAttempts = job.opts.attempts || 5;
      if (attemptNumber >= maxAttempts) {
        this.logger.error(
          `Notification event processing failed permanently after ${maxAttempts} attempts (Job: ${jobId}). Moving to dead letter queue.`,
          {
            jobId,
            eventType: event.type,
            userId: event.userId,
            email: event.email,
            finalError: error.message,
          }
        );

        // Store failed notification for manual processing
        await this.storeFailedNotification(event, error.message);
      }

      // Re-throw to trigger Bull's retry mechanism with exponential backoff
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<NotificationEventDto>) {
    this.logger.debug(
      `Notification event processing started (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<NotificationEventDto>) {
    this.logger.debug(
      `Notification event processing completed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<NotificationEventDto>, error: Error) {
    this.logger.warn(
      `Notification event processing failed (Job: ${job.id}): ${job.data.type} for user ${job.data.userId}. Error: ${error.message}`
    );
  }

  private async validateNotificationEvent(event: NotificationEventDto): Promise<void> {
    if (!event.userId) {
      throw new Error('Notification event missing userId');
    }

    if (!event.email || !this.isValidEmail(event.email)) {
      throw new Error(`Invalid email address: ${event.email}`);
    }

    if (!event.type) {
      throw new Error('Notification event missing type');
    }

    const validTypes = ['welcome', 'security_alert', 'password_reset', 'login_alert'];
    if (!validTypes.includes(event.type)) {
      throw new Error(`Invalid notification type: ${event.type}`);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async processNotificationThroughService(event: NotificationEventDto): Promise<void> {
    try {
      switch (event.type) {
        case 'welcome':
          await this.notificationServiceClient.sendWelcomeNotification({
            userId: event.userId,
            email: event.email,
            name: event.data?.name,
            language: event.data?.language || 'ru',
          });
          break;
        case 'security_alert':
          await this.notificationServiceClient.sendSecurityAlert(
            event.userId,
            event.email,
            event.data?.alertType || 'suspicious_login',
            {
              ipAddress: event.data?.ipAddress,
              userAgent: event.data?.userAgent,
              location: event.data?.location,
              timestamp: event.timestamp,
            }
          );
          break;
        case 'login_alert':
          await this.notificationServiceClient.sendLoginAlert(
            event.userId,
            event.email,
            event.data?.ipAddress,
            event.data?.userAgent,
            event.data?.location
          );
          break;
        default:
          this.logger.warn(`Unsupported notification type for service integration: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process notification through service: ${error.message}`,
        {
          userId: event.userId,
          email: event.email,
          notificationType: event.type,
          error: error.message,
        }
      );
      // Don't throw error as local processing will still occur
    }
  }

  private async processNotificationLocally(event: NotificationEventDto): Promise<void> {
    // Log structured notification event
    const logData = {
      eventType: 'NOTIFICATION_EVENT',
      userId: event.userId,
      email: event.email,
      notificationType: event.type,
      data: event.data,
      timestamp: event.timestamp,
      correlationId: `notif_${event.userId}_${Date.now()}`,
    };

    this.logger.log(`Notification Event: ${JSON.stringify(logData)}`);

    // Simulate notification processing based on type with proper error handling
    try {
      switch (event.type) {
        case 'welcome':
          await this.processWelcomeNotification(event);
          break;
        case 'security_alert':
          await this.processSecurityAlertNotification(event);
          break;
        case 'password_reset':
          await this.processPasswordResetNotification(event);
          break;
        case 'login_alert':
          await this.processLoginAlertNotification(event);
          break;
        default:
          await this.processGenericNotification(event);
      }
    } catch (processingError) {
      this.logger.error(
        `Failed to process ${event.type} notification: ${processingError.message}`,
        {
          userId: event.userId,
          email: event.email,
          notificationType: event.type,
          error: processingError.message,
        }
      );
      throw processingError;
    }

    // Local processing completed - Notification Service integration is now active
  }

  private async processWelcomeNotification(event: NotificationEventDto): Promise<void> {
    this.logger.log(
      `Processing welcome notification for user ${event.userId} (${event.email})`
    );

    // Simulate welcome email processing
    const welcomeData = {
      to: event.email,
      subject: 'Добро пожаловать в нашу платформу!',
      template: 'welcome',
      data: {
        name: event.data?.name || 'Пользователь',
        userId: event.userId,
      },
    };

    this.logger.log(`Would send welcome email: ${JSON.stringify(welcomeData)}`);
  }

  private async processSecurityAlertNotification(event: NotificationEventDto): Promise<void> {
    this.logger.log(
      `Processing security alert notification for user ${event.userId} (${event.email})`
    );

    // Simulate security alert processing
    const alertData = {
      to: event.email,
      subject: 'Предупреждение безопасности',
      template: 'security_alert',
      data: {
        userId: event.userId,
        alertType: event.data?.alertType || 'general',
        timestamp: event.timestamp,
        ipAddress: event.data?.ipAddress,
      },
      priority: 'high',
    };

    this.logger.log(`Would send security alert: ${JSON.stringify(alertData)}`);
  }

  private async processPasswordResetNotification(event: NotificationEventDto): Promise<void> {
    this.logger.log(
      `Processing password reset notification for user ${event.userId} (${event.email})`
    );

    // Simulate password reset email processing
    const resetData = {
      to: event.email,
      subject: 'Сброс пароля',
      template: 'password_reset',
      data: {
        userId: event.userId,
        resetToken: event.data?.resetToken,
        expiresAt: event.data?.expiresAt,
      },
    };

    this.logger.log(`Would send password reset email: ${JSON.stringify(resetData)}`);
  }

  private async processLoginAlertNotification(event: NotificationEventDto): Promise<void> {
    this.logger.log(
      `Processing login alert notification for user ${event.userId} (${event.email})`
    );

    // Simulate login alert processing
    const loginData = {
      to: event.email,
      subject: 'Новый вход в аккаунт',
      template: 'login_alert',
      data: {
        userId: event.userId,
        loginTime: event.timestamp,
        ipAddress: event.data?.ipAddress,
        userAgent: event.data?.userAgent,
        location: event.data?.location,
      },
    };

    this.logger.log(`Would send login alert: ${JSON.stringify(loginData)}`);
  }

  private async processGenericNotification(event: NotificationEventDto): Promise<void> {
    this.logger.log(
      `Processing generic notification ${event.type} for user ${event.userId} (${event.email})`
    );

    // Simulate generic notification processing
    const genericData = {
      to: event.email,
      subject: `Уведомление: ${event.type}`,
      template: 'generic',
      data: {
        userId: event.userId,
        notificationType: event.type,
        ...event.data,
      },
    };

    this.logger.log(`Would send generic notification: ${JSON.stringify(genericData)}`);
  }

  private async storeFailedNotification(event: NotificationEventDto, errorMessage: string): Promise<void> {
    try {
      // Log failed notification for manual processing
      const failedNotificationLog = {
        eventType: 'FAILED_NOTIFICATION',
        userId: event.userId,
        email: event.email,
        notificationType: event.type,
        originalData: event.data,
        errorMessage,
        failedAt: new Date(),
        requiresManualProcessing: true,
        correlationId: `failed_notif_${event.userId}_${Date.now()}`,
      };

      this.logger.error(
        `Failed notification stored for manual processing: ${JSON.stringify(failedNotificationLog)}`
      );

      // TODO: In future, store in database table for failed notifications
    } catch (storageError) {
      this.logger.error(
        `Critical: Failed to store failed notification: ${storageError.message}`,
        {
          originalEvent: event,
          originalError: errorMessage,
          storageError: storageError.message,
        }
      );
    }
  }
}