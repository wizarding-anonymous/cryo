import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { KAFKA_SERVICE } from '../../infrastructure/event-emitters/kafka.module';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/outbox.repository';
import { IEvent } from './event.interface';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka,
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

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.kafkaClient.emit(topic, event.data).toPromise();
        this.logger.log(`Event published to topic ${topic} on attempt ${attempt}`);
        return; // Success
      } catch (error) {
        this.logger.warn(
          `Failed to publish event to topic ${topic}, attempt ${attempt}/${this.retryAttempts}`,
          error.message,
        );
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
        }
      }
    }

    this.logger.error(`All attempts to publish to topic ${topic} failed. Saving to outbox.`);
    try {
      await this.outboxRepository.save(event);
      this.logger.log(`Event saved to outbox for topic ${topic}`);
    } catch (dbError) {
      this.logger.error(`CRITICAL: Failed to save event to outbox for topic ${topic}`, dbError.message);
      // In a real system, this would trigger a critical alert.
    }
  }
}
