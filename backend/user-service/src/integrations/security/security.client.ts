import { Injectable, Logger } from '@nestjs/common';

interface SecurityEvent {
  userId: string;
  type:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'PASSWORD_CHANGE'
    | 'USER_REGISTRATION';
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
    this.logger.debug(`[MOCK] Payload: ${JSON.stringify(event)}`);

    // Simulate an async API call
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.logger.log(
      `[MOCK] Successfully logged security event for user ${event.userId}.`,
    );
  }
}
