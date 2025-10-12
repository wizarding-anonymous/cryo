import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient, ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';
import { LocalSecurityLoggerService } from '../fallback/local-security-logger.service';

export interface SecurityEvent {
  userId: string;
  type: 'USER_REGISTRATION' | 'USER_LOGIN' | 'USER_LOGOUT' | 'FAILED_LOGIN' | 'PASSWORD_CHANGE' | 'TOKEN_REFRESH';
  ipAddress: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SuspiciousActivityResponse {
  suspicious: boolean;
  riskScore?: number;
  reasons?: string[];
}

@Injectable()
export class SecurityServiceClient extends BaseCircuitBreakerClient {
  private readonly eventQueue: SecurityEvent[] = [];
  private readonly maxQueueSize = 1000;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor(
    httpService: HttpService,
    configService: ConfigService,
    circuitBreakerService: CircuitBreakerService,
    private readonly circuitBreakerConfig: CircuitBreakerConfig,
    private readonly localSecurityLogger: LocalSecurityLoggerService,
  ) {
    super(
      httpService,
      configService,
      circuitBreakerService,
      'SecurityService',
      'SECURITY_SERVICE_URL',
      'http://localhost:3010',
      circuitBreakerConfig.getSecurityServiceConfig(),
    );

    // Start retry mechanism for queued events
    this.startRetryMechanism();
  }

  /**
   * Log security event with Circuit Breaker protection and enhanced fallback
   * Requirements: 6.1, 6.2, 6.3 - Log authentication events to Security Service
   * Requirement: 6.6 - Handle Security Service unavailability gracefully
   * Task 17.3: Enhanced fallback with local security logging
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.post('/security/events', event);
      this.logger.log(`Security event logged: ${event.type} for user ${event.userId}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Security Service unavailable, using local fallback: ${event.type} for user ${event.userId}`);
        
        // Use enhanced local fallback
        await this.localSecurityLogger.logEventLocally(event);
        this.queueEvent(event);
        return; // Don't throw error as this is not critical for auth flow
      }
      
      this.logger.error('Failed to log security event', {
        error: error.message,
        stack: error.stack,
        eventType: event.type,
        userId: event.userId,
      });
      
      // Use local fallback for any error
      await this.localSecurityLogger.logEventLocally(event);
      this.queueEvent(event);
      // Don't throw error as this is not critical for auth flow
    }
  }

  /**
   * Check suspicious activity with Circuit Breaker protection and local fallback
   * Requirement: 6.6 - Handle Security Service unavailability gracefully
   * Task 17.3: Enhanced fallback with local suspicious activity detection
   */
  async checkSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const response = await this.get<SuspiciousActivityResponse>('/security/check-suspicious', {
        params: { userId, ipAddress }
      });
      
      this.logger.debug(`Suspicious activity check for user ${userId}: ${response.suspicious}`);
      return response.suspicious;
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Security Service unavailable, using local fallback for suspicious activity check: ${userId}`);
        
        // Use local fallback for suspicious activity detection
        const localResult = await this.localSecurityLogger.checkSuspiciousActivityLocally(userId, ipAddress);
        this.logger.debug(`Local suspicious activity check for user ${userId}: ${localResult.suspicious}`, {
          reasons: localResult.reasons,
        });
        
        return localResult.suspicious;
      }
      
      this.logger.error('Failed to check suspicious activity', {
        error: error.message,
        stack: error.stack,
        userId,
        ipAddress,
      });
      
      // Try local fallback even on other errors
      try {
        const localResult = await this.localSecurityLogger.checkSuspiciousActivityLocally(userId, ipAddress);
        this.logger.warn(`Using local fallback due to Security Service error for user ${userId}: ${localResult.suspicious}`);
        return localResult.suspicious;
      } catch (localError) {
        this.logger.error(`Local fallback also failed: ${localError.message}`);
        return false; // Fail open for availability
      }
    }
  }

  /**
   * Log failed login attempt with enhanced metadata
   * Requirement: 6.2, 6.3 - Log authentication events to Security Service
   */
  async logFailedLoginAttempt(
    email: string,
    ipAddress: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: SecurityEvent = {
      userId: 'unknown', // We don't have userId for failed attempts
      type: 'FAILED_LOGIN',
      ipAddress,
      timestamp: new Date(),
      metadata: {
        email,
        reason,
        ...metadata,
      },
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Log password change event
   * Requirement: 6.1, 6.2, 6.3 - Log authentication events to Security Service
   */
  async logPasswordChange(
    userId: string,
    ipAddress: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: SecurityEvent = {
      userId,
      type: 'PASSWORD_CHANGE',
      ipAddress,
      timestamp: new Date(),
      metadata,
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Log token refresh event
   * Requirement: 6.1, 6.2, 6.3 - Log authentication events to Security Service
   */
  async logTokenRefresh(
    userId: string,
    ipAddress: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: SecurityEvent = {
      userId,
      type: 'TOKEN_REFRESH',
      ipAddress,
      timestamp: new Date(),
      metadata,
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Queue event for retry when service is unavailable
   * Requirement: 6.6 - Handle Security Service unavailability gracefully
   */
  private queueEvent(event: SecurityEvent): void {
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest event to make room
      this.eventQueue.shift();
      this.logger.warn('Security event queue full, removing oldest event');
    }
    
    this.eventQueue.push(event);
    this.logger.debug(`Queued security event: ${event.type} for user ${event.userId}. Queue size: ${this.eventQueue.length}`);
  }

  /**
   * Start retry mechanism for queued events
   * Requirement: 6.6 - Implement proper timeout and retry logic
   */
  private startRetryMechanism(): void {
    this.retryInterval = setInterval(async () => {
      if (this.eventQueue.length === 0) {
        return;
      }

      // Don't retry if circuit breaker is open
      if (this.isCircuitBreakerOpen()) {
        this.logger.debug('Circuit breaker is open, skipping retry of queued events');
        return;
      }

      const eventsToRetry = [...this.eventQueue];
      this.eventQueue.length = 0; // Clear the queue

      this.logger.log(`Retrying ${eventsToRetry.length} queued security events`);

      for (const event of eventsToRetry) {
        try {
          await this.post('/security/events', event);
          this.logger.debug(`Successfully retried security event: ${event.type} for user ${event.userId}`);
        } catch (error) {
          // Re-queue failed events
          this.queueEvent(event);
          this.logger.debug(`Failed to retry security event, re-queued: ${event.type} for user ${event.userId}`);
        }
      }
    }, 30000); // Retry every 30 seconds
  }

  /**
   * Get local security events for a user (fallback method)
   * Task 17.3: Локальный доступ к событиям безопасности
   */
  async getLocalEventsForUser(userId: string, limit: number = 50): Promise<any[]> {
    try {
      return await this.localSecurityLogger.getLocalEventsForUser(userId, limit);
    } catch (error) {
      this.logger.error(`Failed to get local events for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get local security statistics (fallback method)
   * Task 17.3: Локальная аналитика безопасности
   */
  async getLocalSecurityStats(hours: number = 24): Promise<any> {
    try {
      return await this.localSecurityLogger.getLocalSecurityStats(hours);
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
   * Get queue statistics for monitoring
   */
  getQueueStats() {
    const localStats = this.localSecurityLogger.getQueueStats();
    
    return {
      queueSize: this.eventQueue.length,
      maxQueueSize: this.maxQueueSize,
      circuitBreakerState: this.getCircuitBreakerState(),
      circuitBreakerStats: this.getCircuitBreakerStats(),
      localFallback: localStats,
    };
  }

  /**
   * Clear event queue (for testing or manual intervention)
   */
  clearQueue(): void {
    this.eventQueue.length = 0;
    this.logger.log('Security event queue cleared');
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