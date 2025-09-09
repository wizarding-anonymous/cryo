import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { GameService } from '../application/services/game.service';
import { DeveloperController } from '../infrastructure/http/controllers/developer.controller';
import { SearchModule } from './search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game]), SearchModule],
  providers: [GameService, GameRepository],
  controllers: [DeveloperController],
})
export class DeveloperModule {}
