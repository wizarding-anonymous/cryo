import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventPublisherService } from './event-publisher.service';

@Module({
  imports: [ConfigModule],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class EventPublisherModule {}
