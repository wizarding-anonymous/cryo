import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../application/events/events.module';
import { User } from '../domain/entities/user.entity';
import { PublisherProfile } from '../domain/entities/publisher-profile.entity';
import { BasicPublisherService } from '../application/services/basic-publisher.service';
import { BasicPublisherController } from '../infrastructure/http/controllers/basic-publisher.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PublisherProfile]),
    EventsModule,
  ],
  providers: [BasicPublisherService],
  controllers: [BasicPublisherController],
})
export class PublisherModule {}
