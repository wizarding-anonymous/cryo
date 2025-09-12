import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryGame } from './entities/library-game.entity';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LibraryGame])],
  controllers: [LibraryController],
  providers: [LibraryService, SearchService],
  exports: [LibraryService, SearchService],
})
export class LibraryModule {}
