import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { 
  WelcomeNotificationRequest, 
  SecurityAlertNotificationRequest 
} from '../http-client/notification-service.client';

export interface QueuedNotification {
  id: string;
  type: 'welcome' | 'security_alert' | 'password_change' | 'account_locked';
  data: WelcomeNotificationRequest | SecurityAlertNotificationRequest | any;
  priority: 'high' | 'normal' | 'low';
  queuedAt: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Local notification queue service for graceful degradation when Notification Service is unavailable
 * Task 17.3: Создать режим "только аутентификация" при сбоях Notification Service
 */
@Injectable()
export class LocalNotificationQueueService {
  private readonly logger = new Logger(LocalNotificationQueueService.name);
  private readonly localQueue: Map<string, QueuedNotification> = new Map();
  private readonly maxLocalQueueSize = 10000;
  private readonly redisKeyPrefix = 'auth-service:notification-queue';
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly redisService: RedisService) {
    this.startQueueProcessor();
    this.loadQueueFromRedis();
    this.logger.log('Local Notification Queue initialized with enhanced fallback capabilities');
  }

  /**
   * Queue notification with priority and retry logic
   * Task 17.3: Локальная очередь уведомлений с приоритетами
   */
  async queueNotification(
    type: QueuedNotification['type'],
    data: any,
    priority: QueuedNotification['priority'] = 'normal',
    maxRetries: number = 5
  ): Promise<string> {
    const notificationId = this.generateId();
    const now = new Date();
    
    const queuedNotification: QueuedNotification = {
      id: notificationId,
      type,
      data,
      priority,
      queuedAt: now,
      retryCount: 0,
      maxRetries,
      nextRetryAt: now,
      metadata: {
        originalTimestamp: now.toISOString(),
        source: 'auth-service',
      },
    };

    // Store in local queue
    if (this.localQueue.size >= this.maxLocalQueueSize) {
      this.evictOldestNotification();
    }
    
    this.localQueue.set(notificationId, queuedNotification);

    // Also store in Redis for persistence
    try {
      await this.storeInRedis(queuedNotification);
    } catch (error) {
      this.logger.warn(`Failed to store notification in Redis: ${error.message}`);
    }

    this.logger.debug(`Queued ${type} notification with priority ${priority}: ${notificationId}`);
    return notificationId;
  }

  /**
   * Queue welcome notification
   * Task 17.3: Специализированная очередь для welcome уведомлений
   */
  async queueWelcomeNotification(request: WelcomeNotificationRequest): Promise<string> {
    return this.queueNotification('welcome', request, 'normal', 3);
  }

  /**
   * Queue security alert notification with high priority
   * Task 17.3: Высокоприоритетная очередь для security alert уведомлений
   */
  async queueSecurityAlert(request: SecurityAlertNotificationRequest): Promise<string> {
    return this.queueNotification('security_alert', request, 'high', 5);
  }

  /**
   * Queue password change notification
   * Task 17.3: Очередь для уведомлений о смене пароля
   */
  async queuePasswordChangeNotification(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<string> {
    const request = {
      userId,
      email,
      alertType: 'password_change' as const,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };
    
    return this.queueNotification('password_change', request, 'high', 5);
  }

  /**
   * Queue account locked notification
   * Task 17.3: Очередь для уведомлений о блокировке аккаунта
   */
  async queueAccountLockedNotification(
    userId: string,
    email: string,
    reason: string,
    ipAddress?: string
  ): Promise<string> {
    const request = {
      userId,
      email,
      alertType: 'account_locked' as const,
      reason,
      ipAddress,
      timestamp: new Date(),
    };
    
    return this.queueNotification('account_locked', request, 'high', 3);
  }

  /**
   * Get queued notifications by priority
   * Task 17.3: Получение уведомлений по приоритету
   */
  getQueuedNotificationsByPriority(
    priority: QueuedNotification['priority'],
    limit: number = 50
  ): QueuedNotification[] {
    const notifications = Array.from(this.localQueue.values())
      .filter(n => n.priority === priority)
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())
      .slice(0, limit);
    
    return notifications;
  }

  /**
   * Get notifications ready for retry
   * Task 17.3: Получение уведомлений готовых для повторной отправки
   */
  getNotificationsReadyForRetry(limit: number = 20): QueuedNotification[] {
    const now = new Date();
    
    return Array.from(this.localQueue.values())
      .filter(n => n.nextRetryAt <= now && n.retryCount < n.maxRetries)
      .sort((a, b) => {
        // Sort by priority first (high -> normal -> low), then by retry time
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.nextRetryAt.getTime() - b.nextRetryAt.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Mark notification as sent successfully
   * Task 17.3: Отметка успешно отправленных уведомлений
   */
  async markNotificationAsSent(notificationId: string): Promise<void> {
    this.localQueue.delete(notificationId);
    
    try {
      await this.removeFromRedis(notificationId);
    } catch (error) {
      this.logger.warn(`Failed to remove notification from Redis: ${error.message}`);
    }
    
    this.logger.debug(`Notification marked as sent and removed: ${notificationId}`);
  }

  /**
   * Mark notification as failed and schedule retry
   * Task 17.3: Обработка неудачных отправок с экспоненциальной задержкой
   */
  async markNotificationAsFailed(
    notificationId: string,
    error: string
  ): Promise<void> {
    const notification = this.localQueue.get(notificationId);
    if (!notification) {
      this.logger.warn(`Notification not found for retry: ${notificationId}`);
      return;
    }

    notification.retryCount++;
    notification.metadata = {
      ...notification.metadata,
      lastError: error,
      lastRetryAt: new Date().toISOString(),
    };

    if (notification.retryCount >= notification.maxRetries) {
      // Max retries reached, move to dead letter queue
      await this.moveToDeadLetterQueue(notification, error);
      this.localQueue.delete(notificationId);
      await this.removeFromRedis(notificationId);
      
      this.logger.error(`Notification permanently failed after ${notification.maxRetries} retries: ${notificationId}`, {
        type: notification.type,
        error,
        userId: notification.data.userId,
      });
    } else {
      // Schedule next retry with exponential backoff
      const backoffMinutes = Math.pow(2, notification.retryCount - 1) * 5; // 5, 10, 20, 40 minutes
      notification.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
      
      try {
        await this.storeInRedis(notification);
      } catch (redisError) {
        this.logger.warn(`Failed to update notification in Redis: ${redisError.message}`);
      }
      
      this.logger.warn(`Notification retry scheduled (attempt ${notification.retryCount}/${notification.maxRetries}): ${notificationId}`, {
        nextRetryAt: notification.nextRetryAt,
        backoffMinutes,
      });
    }
  }

  /**
   * Get queue statistics
   * Task 17.3: Статистика очереди уведомлений
   */
  getQueueStats(): {
    totalQueued: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    readyForRetry: number;
    failedPermanently: number;
    oldestQueuedAt?: Date;
    averageRetryCount: number;
  } {
    const notifications = Array.from(this.localQueue.values());
    const byPriority: Record<string, number> = { high: 0, normal: 0, low: 0 };
    const byType: Record<string, number> = {};
    let totalRetries = 0;
    let oldestQueuedAt: Date | undefined;
    
    const now = new Date();
    let readyForRetry = 0;

    for (const notification of notifications) {
      byPriority[notification.priority]++;
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      totalRetries += notification.retryCount;
      
      if (!oldestQueuedAt || notification.queuedAt < oldestQueuedAt) {
        oldestQueuedAt = notification.queuedAt;
      }
      
      if (notification.nextRetryAt <= now && notification.retryCount < notification.maxRetries) {
        readyForRetry++;
      }
    }

    return {
      totalQueued: notifications.length,
      byPriority,
      byType,
      readyForRetry,
      failedPermanently: 0, // Would need to track this separately
      oldestQueuedAt,
      averageRetryCount: notifications.length > 0 ? totalRetries / notifications.length : 0,
    };
  }

  /**
   * Clear all queued notifications (for testing or emergency)
   * Task 17.3: Очистка очереди для экстренных случаев
   */
  async clearQueue(): Promise<void> {
    const count = this.localQueue.size;
    this.localQueue.clear();
    
    try {
      const pattern = `${this.redisKeyPrefix}:*`;
      const keys = await this.redisService.keys(pattern);
      for (const key of keys) {
        await this.redisService.delete(key);
      }
    } catch (error) {
      this.logger.warn(`Failed to clear Redis queue: ${error.message}`);
    }
    
    this.logger.log(`Cleared notification queue: ${count} notifications removed`);
  }

  /**
   * Get notifications older than specified time for cleanup
   * Task 17.3: Очистка старых уведомлений
   */
  async cleanupOldNotifications(maxAgeHours: number = 72): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const toRemove: string[] = [];
    
    for (const [id, notification] of this.localQueue) {
      if (notification.queuedAt < cutoffTime) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.localQueue.delete(id);
      try {
        await this.removeFromRedis(id);
      } catch (error) {
        this.logger.warn(`Failed to remove old notification from Redis: ${error.message}`);
      }
    }
    
    if (toRemove.length > 0) {
      this.logger.log(`Cleaned up ${toRemove.length} old notifications older than ${maxAgeHours} hours`);
    }
    
    return toRemove.length;
  }

  /**
   * Store notification in Redis for persistence
   * Task 17.3: Персистентное хранение в Redis
   */
  private async storeInRedis(notification: QueuedNotification): Promise<void> {
    const key = `${this.redisKeyPrefix}:${notification.id}`;
    const value = JSON.stringify(notification);
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days TTL
    
    await this.redisService.set(key, value, ttlSeconds);
  }

  /**
   * Remove notification from Redis
   * Task 17.3: Удаление из Redis после обработки
   */
  private async removeFromRedis(notificationId: string): Promise<void> {
    const key = `${this.redisKeyPrefix}:${notificationId}`;
    await this.redisService.delete(key);
  }

  /**
   * Load queue from Redis on startup
   * Task 17.3: Восстановление очереди из Redis при запуске
   */
  private async loadQueueFromRedis(): Promise<void> {
    try {
      const pattern = `${this.redisKeyPrefix}:*`;
      const keys = await this.redisService.keys(pattern);
      
      let loaded = 0;
      for (const key of keys) {
        try {
          const value = await this.redisService.get(key);
          if (value) {
            const notification: QueuedNotification = JSON.parse(value);
            // Convert date strings back to Date objects
            notification.queuedAt = new Date(notification.queuedAt);
            notification.nextRetryAt = new Date(notification.nextRetryAt);
            
            this.localQueue.set(notification.id, notification);
            loaded++;
          }
        } catch (error) {
          this.logger.warn(`Failed to load notification from Redis key ${key}: ${error.message}`);
        }
      }
      
      if (loaded > 0) {
        this.logger.log(`Loaded ${loaded} notifications from Redis on startup`);
      }
    } catch (error) {
      this.logger.error(`Failed to load queue from Redis: ${error.message}`);
    }
  }

  /**
   * Move notification to dead letter queue
   * Task 17.3: Dead letter queue для окончательно неудачных уведомлений
   */
  private async moveToDeadLetterQueue(
    notification: QueuedNotification,
    finalError: string
  ): Promise<void> {
    try {
      const dlqKey = `${this.redisKeyPrefix}:dlq:${notification.id}`;
      const dlqData = {
        ...notification,
        finalError,
        movedToDlqAt: new Date().toISOString(),
      };
      
      const ttlSeconds = 30 * 24 * 60 * 60; // Keep in DLQ for 30 days
      await this.redisService.set(dlqKey, JSON.stringify(dlqData), ttlSeconds);
      
      this.logger.warn(`Moved notification to dead letter queue: ${notification.id}`, {
        type: notification.type,
        retryCount: notification.retryCount,
        finalError,
      });
    } catch (error) {
      this.logger.error(`Failed to move notification to DLQ: ${error.message}`);
    }
  }

  /**
   * Evict oldest notification when queue is full
   * Task 17.3: Эвикция старых уведомлений при переполнении
   */
  private evictOldestNotification(): void {
    let oldestId: string | null = null;
    let oldestTime: Date | null = null;
    
    for (const [id, notification] of this.localQueue) {
      if (!oldestTime || notification.queuedAt < oldestTime) {
        oldestTime = notification.queuedAt;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      const evicted = this.localQueue.get(oldestId);
      this.localQueue.delete(oldestId);
      
      this.logger.warn(`Evicted oldest notification due to queue size limit: ${oldestId}`, {
        type: evicted?.type,
        queuedAt: evicted?.queuedAt,
      });
    }
  }

  /**
   * Start queue processor for automatic retries
   * Task 17.3: Автоматический процессор очереди
   */
  private startQueueProcessor(): void {
    // Process queue every 2 minutes
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        return;
      }
      
      this.isProcessing = true;
      
      try {
        // Clean up old notifications every hour
        if (Math.random() < 0.1) { // 10% chance each cycle (roughly every 20 minutes)
          await this.cleanupOldNotifications();
        }
        
        // Log queue statistics every 10 minutes
        if (Math.random() < 0.2) { // 20% chance each cycle (roughly every 10 minutes)
          const stats = this.getQueueStats();
          this.logger.log('Notification queue statistics:', stats);
        }
      } catch (error) {
        this.logger.error(`Queue processor error: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    }, 2 * 60 * 1000);

    this.logger.log('Notification queue processor started');
  }

  /**
   * Generate unique notification ID
   * Task 17.3: Генерация уникальных ID для уведомлений
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Cleanup resources
   */
  onModuleDestroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}