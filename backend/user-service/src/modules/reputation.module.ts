import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReputationService } from '../application/services/reputation.service';
import { ReputationController } from '../infrastructure/http/controllers/reputation.controller';
import { User } from '../domain/entities/user.entity';
import { ReputationEntry } from '../domain/entities/reputation-entry.entity';
import { EventsModule } from '../application/events/events.module';
import { RoleModule } from './role.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, ReputationEntry]), EventsModule, RoleModule],
  controllers: [ReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
