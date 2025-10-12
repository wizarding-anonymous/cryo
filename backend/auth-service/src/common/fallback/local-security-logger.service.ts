import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { SecurityEvent } from '../../entities/security-event.entity';
import { SecurityEvent as SecurityEventDto } from '../http-client/security-service.client';

/**
 * Local security logger service for graceful degradation when Security Service is unavailable
 * Task 17.3: Реализовать fallback для Security Service (локальное логирование)
 */
@Injectable()
export class LocalSecurityLoggerService {
  private readonly logger = new Logger(LocalSecurityLoggerService.name);
  private readonly eventQueue: SecurityEventDto[] = [];
  private readonly maxQueueSize = 5000; // Increased for better resilience
  private retryInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
  ) {
    this.startPeriodicSync();
    this.logger.log('Local Security Logger initialized with enhanced fallback capabilities');
  }

  /**
   * Log security event locally when Security Service is unavailable
   * Task 17.3: Локальное логирование для fallback Security Service
   */
  async logEventLocally(event: SecurityEventDto): Promise<void> {
    try {
      // Store in local database immediately
      const localEvent = this.securityEventRepository.create({
        userId: event.userId,
        type: event.type as any,
        ipAddress: event.ipAddress,
        createdAt: event.timestamp,
        metadata: event.metadata || {},
        processed: false, // Mark as not yet sent to Security Service
      });

      await this.securityEventRepository.save(localEvent);
      
      // Also queue for retry to Security Service
      this.queueEventForRetry(event);
      
      this.logger.log(`Security event logged locally: ${event.type} for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to log security event locally: ${error.message}`, {
        eventType: event.type,
        userId: event.userId,
        error: error.stack,
      });
      
      // As last resort, queue in memory
      this.queueEventForRetry(event);
    }
  }

  /**
   * Get local security events for a specific user
   * Task 17.3: Локальный доступ к событиям безопасности при недоступности Security Service
   */
  async getLocalEventsForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityEvent[]> {
    try {
      return await this.securityEventRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      this.logger.error(`Failed to get local events for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent security events by type
   * Task 17.3: Локальная аналитика событий безопасности
   */
  async getRecentEventsByType(
    type: string,
    hours: number = 24,
    limit: number = 100
  ): Promise<SecurityEvent[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      return await this.securityEventRepository.find({
        where: {
          type: type as any,
          createdAt: MoreThanOrEqual(since),
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get recent events by type ${type}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check for suspicious activity patterns locally
   * Task 17.3: Локальная детекция подозрительной активности
   */
  async checkSuspiciousActivityLocally(
    userId: string,
    ipAddress: string,
    timeWindowMinutes: number = 15
  ): Promise<{ suspicious: boolean; reasons: string[] }> {
    try {
      const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      
      // Check for multiple failed login attempts
      const failedLogins = await this.securityEventRepository
        .createQueryBuilder('event')
        .where('event.userId = :userId', { userId })
        .andWhere('event.type = :type', { type: 'failed_login' })
        .andWhere('event.createdAt >= :since', { since })
        .getCount();

      // Check for logins from different IPs
      const recentLogins = await this.securityEventRepository
        .createQueryBuilder('event')
        .select(['event.ipAddress'])
        .where('event.userId = :userId', { userId })
        .andWhere('event.type = :type', { type: 'login' })
        .andWhere('event.createdAt >= :since', { since })
        .getMany();

      const uniqueIPs = new Set(recentLogins.map(login => login.ipAddress));
      
      // Check for failed logins from the current IP
      const failedLoginsFromCurrentIP = await this.securityEventRepository
        .createQueryBuilder('event')
        .where('event.userId = :userId', { userId })
        .andWhere('event.type = :type', { type: 'failed_login' })
        .andWhere('event.ipAddress = :ipAddress', { ipAddress })
        .andWhere('event.createdAt >= :since', { since })
        .getCount();
      
      const reasons: string[] = [];
      let suspicious = false;

      if (failedLogins >= 5) {
        suspicious = true;
        reasons.push(`${failedLogins} failed login attempts in ${timeWindowMinutes} minutes`);
      }

      if (failedLoginsFromCurrentIP >= 3) {
        suspicious = true;
        reasons.push(`${failedLoginsFromCurrentIP} failed login attempts from IP ${ipAddress} in ${timeWindowMinutes} minutes`);
      }

      if (uniqueIPs.size >= 3) {
        suspicious = true;
        reasons.push(`Login attempts from ${uniqueIPs.size} different IP addresses`);
      }

      // Check for rapid successive logins
      if (recentLogins.length >= 10) {
        suspicious = true;
        reasons.push(`${recentLogins.length} login attempts in ${timeWindowMinutes} minutes`);
      }

      // Check if current IP is different from recent successful logins
      const recentSuccessfulLogins = recentLogins.filter(login => 
        login.ipAddress && login.ipAddress !== ipAddress
      );
      
      if (recentSuccessfulLogins.length > 0 && !uniqueIPs.has(ipAddress)) {
        suspicious = true;
        reasons.push(`Login attempt from new IP address ${ipAddress} (recent logins from ${uniqueIPs.size} other IPs)`);
      }

      this.logger.debug(`Local suspicious activity check for user ${userId}: ${suspicious}`, {
        failedLogins,
        uniqueIPs: uniqueIPs.size,
        totalLogins: recentLogins.length,
        reasons,
      });

      return { suspicious, reasons };
    } catch (error) {
      this.logger.error(`Failed to check suspicious activity locally: ${error.message}`);
      return { suspicious: false, reasons: ['Local check failed'] };
    }
  }

  /**
   * Get unprocessed events that need to be sent to Security Service
   * Task 17.3: Синхронизация с Security Service при восстановлении
   */
  async getUnprocessedEvents(limit: number = 100): Promise<SecurityEvent[]> {
    try {
      return await this.securityEventRepository.find({
        where: { processed: false },
        order: { createdAt: 'ASC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get unprocessed events: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark events as processed after successful sync with Security Service
   * Task 17.3: Отметка обработанных событий после синхронизации
   */
  async markEventsAsProcessed(eventIds: string[]): Promise<void> {
    try {
      await this.securityEventRepository
        .createQueryBuilder()
        .update(SecurityEvent)
        .set({ processed: true })
        .where('id IN (:...eventIds)', { eventIds })
        .execute();
      
      this.logger.debug(`Marked ${eventIds.length} events as processed`);
    } catch (error) {
      this.logger.error(`Failed to mark events as processed: ${error.message}`);
    }
  }

  /**
   * Clean up old processed events to prevent database bloat
   * Task 17.3: Очистка старых событий для предотвращения переполнения БД
   */
  async cleanupOldEvents(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const result = await this.securityEventRepository
        .createQueryBuilder()
        .delete()
        .from(SecurityEvent)
        .where('processed = :processed AND "createdAt" < :cutoffDate', {
          processed: true,
          cutoffDate,
        })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} old security events older than ${daysToKeep} days`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old events: ${error.message}`);
    }
  }

  /**
   * Get local security statistics
   * Task 17.3: Локальная аналитика безопасности
   */
  async getLocalSecurityStats(hours: number = 24): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    uniqueUsers: number;
    uniqueIPs: number;
    suspiciousActivities: number;
    unprocessedEvents: number;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Get all events in time window
      const events = await this.securityEventRepository
        .createQueryBuilder('event')
        .where('event.createdAt >= :since', { since })
        .getMany();

      // Calculate statistics
      const eventsByType: Record<string, number> = {};
      const uniqueUsers = new Set<string>();
      const uniqueIPs = new Set<string>();
      let suspiciousActivities = 0;

      for (const event of events) {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        uniqueUsers.add(event.userId);
        uniqueIPs.add(event.ipAddress);
        
        if (event.type === 'failed_login' || event.metadata?.suspicious) {
          suspiciousActivities++;
        }
      }

      const unprocessedCount = await this.securityEventRepository.count({
        where: { processed: false },
      });

      return {
        totalEvents: events.length,
        eventsByType,
        uniqueUsers: uniqueUsers.size,
        uniqueIPs: uniqueIPs.size,
        suspiciousActivities,
        unprocessedEvents: unprocessedCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get local security stats: ${error.message}`);
      return {
        totalEvents: 0,
        eventsByType: {},
        uniqueUsers: 0,
        uniqueIPs: 0,
        suspiciousActivities: 0,
        unprocessedEvents: 0,
      };
    }
  }

  /**
   * Queue event for retry to Security Service
   * Task 17.3: Очередь для повторной отправки в Security Service
   */
  private queueEventForRetry(event: SecurityEventDto): void {
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest event to make room
      const removed = this.eventQueue.shift();
      this.logger.warn(`Security event queue full, removed oldest event: ${removed?.type}`);
    }
    
    this.eventQueue.push(event);
    this.logger.debug(`Queued security event for retry: ${event.type}. Queue size: ${this.eventQueue.length}`);
  }

  /**
   * Start periodic synchronization with Security Service
   * Task 17.3: Периодическая синхронизация с Security Service
   */
  private startPeriodicSync(): void {
    // Clean up old events daily
    setInterval(async () => {
      await this.cleanupOldEvents();
    }, 24 * 60 * 60 * 1000);

    // Log statistics every hour
    setInterval(async () => {
      const stats = await this.getLocalSecurityStats();
      this.logger.log('Local security statistics:', {
        totalEvents24h: stats.totalEvents,
        unprocessedEvents: stats.unprocessedEvents,
        suspiciousActivities: stats.suspiciousActivities,
        uniqueUsers: stats.uniqueUsers,
        eventsByType: stats.eventsByType,
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Get queue statistics for monitoring
   * Task 17.3: Мониторинг очереди событий
   */
  getQueueStats() {
    return {
      queueSize: this.eventQueue.length,
      maxQueueSize: this.maxQueueSize,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Clear event queue (for testing or manual intervention)
   * Task 17.3: Очистка очереди для тестирования
   */
  clearQueue(): void {
    this.eventQueue.length = 0;
    this.logger.log('Local security event queue cleared');
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