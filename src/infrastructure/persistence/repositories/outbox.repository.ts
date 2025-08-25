import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../../../domain/entities/outbox-event.entity';
import { IEvent } from '../../../application/events/event.interface';

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repository: Repository<OutboxEvent>,
  ) {}

  async save(event: IEvent): Promise<void> {
    const outboxEvent = this.repository.create({
      id: event.data['id'], // Assuming event data has an ID
      eventType: event.topic,
      payload: event.data,
      status: 'pending',
    });
    await this.repository.save(outboxEvent);
  }
}
