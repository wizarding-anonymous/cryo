import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../../infrastructure/event-emitters/kafka.module';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/outbox.repository';
import { EventPublisher } from './event-publisher.service';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([OutboxEvent]),
  ],
  providers: [EventPublisher, OutboxRepository],
  exports: [EventPublisher],
})
export class EventsModule {}
