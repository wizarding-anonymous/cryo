import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
// import { KAFKA_SERVICE } from './events.module';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/outbox.repository';
import { IEvent } from './event.interface';
import { DeviceInfo } from '../../domain/value-objects/device-info.vo';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    // @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async publish(topic: string, eventData: object, eventSchema?: new () => any): Promise<void> {
    if (eventSchema) {
      const eventObject = plainToInstance(eventSchema, eventData);
      const errors = await validate(eventObject);

      if (errors.length > 0) {
        this.logger.error(`Event validation failed for topic ${topic}`, errors);
        throw new Error('Event validation failed');
      }
    }

    const event: IEvent = { topic, data: eventData };

    // Temporarily disabled Kafka publishing
    this.logger.log(`[MOCK] Event would be published to topic ${topic}`);
    return;

    this.logger.error(`All attempts to publish to topic ${topic} failed. Saving to outbox.`);
    try {
      await this.outboxRepository.save(event);
      this.logger.log(`Event saved to outbox for topic ${topic}`);
    } catch (dbError) {
      this.logger.error(`CRITICAL: Failed to save event to outbox for topic ${topic}`, dbError.message);
      // In a real system, this would trigger a critical alert.
    }
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
