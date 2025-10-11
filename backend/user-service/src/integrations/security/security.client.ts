import { Injectable, Logger } from '@nestjs/common';

interface SecurityEvent {
  userId: string;
  type:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'PASSWORD_CHANGE'
    | 'PASSWORD_CHANGED'
    | 'USER_REGISTRATION'
    | 'ACCOUNT_DELETED';
  ipAddress: string;
  timestamp: Date;
  details?: Record<string, any>;
}

@Injectable()
export class SecurityClient {
  private readonly logger = new Logger(SecurityClient.name);

  /**
   * Mocks sending a security event to the Security Service.
   * In a real implementation, this would be an HTTP call.
   * @param event The security event to log.
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.logger.log(
      `[MOCK] Logging security event of type "${event.type}" to Security Service for user ${event.userId}...`,
    );
    
    // Sanitize the event data before logging to avoid exposing sensitive information
    const sanitizedEvent = this.sanitizeEventForLogging(event);
    this.logger.debug(`[MOCK] Payload: ${JSON.stringify(sanitizedEvent)}`);

    // Simulate an async API call
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.logger.log(
      `[MOCK] Successfully logged security event for user ${event.userId}.`,
    );
  }

  /**
   * Sanitizes security event data for safe logging
   * @param event The security event to sanitize
   * @returns Sanitized event data
   */
  private sanitizeEventForLogging(event: SecurityEvent): any {
    return {
      userId: event.userId,
      type: event.type,
      ipAddress: event.ipAddress,
      timestamp: event.timestamp,
      // Don't log details that might contain sensitive information
      details: event.details ? { redacted: true } : undefined,
    };
  }
}
