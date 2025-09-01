import { Injectable, Logger } from '@nestjs/common';
import { DeviceInfo } from '../../domain/value-objects/device-info.vo';

@Injectable()
export class MockEventPublisher {
  private readonly logger = new Logger(MockEventPublisher.name);

  async publish(topic: string, eventData: object, eventSchema?: new () => any): Promise<void> {
    this.logger.log(`[MOCK] Event published to topic ${topic}:`, JSON.stringify(eventData, null, 2));
  }

  /**
   * Публикует событие создания пользовательской сессии
   */
  async publishUserSessionCreated(eventData: {
    userId: string;
    sessionId: string;
    deviceInfo: DeviceInfo;
    ipAddress: string;
    timestamp: Date;
  }): Promise<void> {
    await this.publish('user.session.created', {
      userId: eventData.userId,
      sessionId: eventData.sessionId,
      deviceInfo: eventData.deviceInfo,
      ipAddress: eventData.ipAddress,
      timestamp: eventData.timestamp.toISOString(),
    });
  }

  /**
   * Публикует событие завершения пользовательской сессии
   */
  async publishUserSessionTerminated(eventData: {
    userId: string;
    sessionId: string;
    reason: string;
    timestamp: Date;
  }): Promise<void> {
    await this.publish('user.session.terminated', {
      userId: eventData.userId,
      sessionId: eventData.sessionId,
      reason: eventData.reason,
      timestamp: eventData.timestamp.toISOString(),
    });
  }
}