import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { KAFKA_SERVICE } from '../../infrastructure/event-emitters/kafka.module';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/outbox.repository';
import { IntegrationMonitoringService } from '../services/integration-monitoring.service';
import { IEvent } from './event.interface';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka,
    private readonly outboxRepository: OutboxRepository,
    @Optional() private readonly integrationMonitoringService?: IntegrationMonitoringService,
  ) {}

  async publish(topic: string, eventData: object, eventSchema?: new (...args: any[]) => any): Promise<void> {
    const startTime = Date.now();
    
    if (eventSchema) {
      // For events that are already instances, just validate them
      const eventObject = eventData instanceof eventSchema ? eventData : plainToInstance(eventSchema, eventData);
      const errors = await validate(eventObject);

      if (errors.length > 0) {
        this.logger.error(`Event validation failed for topic ${topic}`, errors);
        if (this.integrationMonitoringService) {
          await this.integrationMonitoringService.recordEventDelivery(topic, false, Date.now() - startTime);
        }
        throw new Error('Event validation failed');
      }
    }

    const event: IEvent = { topic, data: eventData };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.kafkaClient.emit(topic, event.data).toPromise();
        const deliveryTime = Date.now() - startTime;
        
        this.logger.log(`Event published to topic ${topic} on attempt ${attempt} (${deliveryTime}ms)`);
        if (this.integrationMonitoringService) {
          await this.integrationMonitoringService.recordEventDelivery(topic, true, deliveryTime);
        }
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

    const deliveryTime = Date.now() - startTime;
    this.logger.error(`All attempts to publish to topic ${topic} failed. Saving to outbox.`);
    if (this.integrationMonitoringService) {
      await this.integrationMonitoringService.recordEventDelivery(topic, false, deliveryTime);
    }
    
    try {
      await this.outboxRepository.save(event);
      this.logger.log(`Event saved to outbox for topic ${topic}`);
    } catch (dbError) {
      this.logger.error(`CRITICAL: Failed to save event to outbox for topic ${topic}`, dbError.message);
      // In a real system, this would trigger a critical alert.
    }
  }
}
