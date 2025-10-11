import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient, ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';

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
   * Log security event with Circuit Breaker protection and retry mechanism
   * Requirements: 6.1, 6.2, 6.3 - Log authentication events to Security Service
   * Requirement: 6.6 - Handle Security Service unavailability gracefully
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.post('/security/events', event);
      this.logger.log(`Security event logged: ${event.type} for user ${event.userId}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Security Service unavailable, queuing event: ${event.type} for user ${event.userId}`);
        this.queueEvent(event);
        return; // Don't throw error as this is not critical for auth flow
      }
      
      this.logger.error('Failed to log security event', {
        error: error.message,
        stack: error.stack,
        eventType: event.type,
        userId: event.userId,
      });
      
      // Queue event for retry even on other errors
      this.queueEvent(event);
      // Don't throw error as this is not critical for auth flow
    }
  }

  /**
   * Check suspicious activity with Circuit Breaker protection
   * Requirement: 6.6 - Handle Security Service unavailability gracefully
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
        this.logger.warn(`Security Service unavailable for suspicious activity check: ${userId}`);
        return false; // Fail open for availability
      }
      
      this.logger.error('Failed to check suspicious activity', {
        error: error.message,
        stack: error.stack,
        userId,
        ipAddress,
      });
      return false; // Fail open for availability
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
   * Get queue statistics for monitoring
   */
  getQueueStats() {
    return {
      queueSize: this.eventQueue.length,
      maxQueueSize: this.maxQueueSize,
      circuitBreakerState: this.getCircuitBreakerState(),
      circuitBreakerStats: this.getCircuitBreakerStats(),
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