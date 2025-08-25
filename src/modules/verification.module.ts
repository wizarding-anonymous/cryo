import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../application/events/events.module';
import { DeveloperProfile } from '../domain/entities/developer-profile.entity';
import { PublisherProfile } from '../domain/entities/publisher-profile.entity';
import { VerificationService } from '../application/services/verification.service';
import { VerificationController } from '../infrastructure/http/controllers/verification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeveloperProfile, PublisherProfile]),
    EventsModule,
  ],
  providers: [VerificationService],
  controllers: [VerificationController],
})
export class VerificationModule {}
