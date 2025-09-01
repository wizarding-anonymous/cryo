import { Module, Global, Injectable, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/outbox.repository';
import { EventPublisher } from './event-publisher.service';
import { DeviceInfo } from '../../domain/value-objects/device-info.vo';

@Injectable()
class MockEventPublisher {
  private readonly logger = new Logger(MockEventPublisher.name);

  async publish(topic: string, eventData: object): Promise<void> {
    this.logger.log(`[MOCK] Event published to topic ${topic}:`, JSON.stringify(eventData, null, 2));
  }

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

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent]),
  ],
  providers: [
    OutboxRepository,
    {
      provide: EventPublisher,
      useClass: MockEventPublisher,
    },
  ],
  exports: [EventPublisher],
})
export class EventsModule {}
