import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);

  /**
   * Mocks sending a welcome notification to the Notification Service.
   * In a real implementation, this would be an HTTP call.
   * @param userId The ID of the user.
   * @param email The email of the user.
   */
  async sendWelcomeNotification(userId: string, email: string): Promise<void> {
    const payload = {
      userId,
      email,
      type: 'welcome_notification',
    };

    this.logger.log(
      `[MOCK] Sending welcome notification to Notification Service for user ${userId}...`,
    );
    this.logger.debug(`[MOCK] Payload: ${JSON.stringify(payload)}`);

    // Simulate an async API call
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.logger.log(
      `[MOCK] Successfully sent welcome notification for user ${userId}.`,
    );
  }
}
