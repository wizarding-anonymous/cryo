import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { ModerationController } from '../infrastructure/http/controllers/moderation.controller';
import { SearchModule } from './search.module';
import { ModerationService } from '../application/services/moderation.service';
import { EventPublisherModule } from './event-publisher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    SearchModule,
    EventPublisherModule,
  ],
  providers: [ModerationService, GameRepository],
  controllers: [ModerationController],
})
export class ModerationModule {}
