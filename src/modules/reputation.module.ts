import { Module } from '@nestjs/common';
import { ReputationService } from '../application/services/reputation.service';

@Module({
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
