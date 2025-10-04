import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Game } from '../entities/game.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    CommonModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
