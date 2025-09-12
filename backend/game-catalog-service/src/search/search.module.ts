import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Game } from '../entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
