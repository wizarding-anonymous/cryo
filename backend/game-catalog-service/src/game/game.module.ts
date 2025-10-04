import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { SearchService } from '../search/search.service';
import { Game } from '../entities/game.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    CommonModule,
  ],
  controllers: [GameController],
  providers: [GameService, SearchService],
})
export class GameModule {}
