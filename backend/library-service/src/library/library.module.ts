import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryGame } from './entities/library-game.entity';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import { LibraryController } from './library.controller';
import { LibraryRepository } from './repositories/library.repository';
import { ClientsModule } from '../clients/clients.module';
import { AppCacheModule } from '../cache/cache.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LibraryGame]), 
    ClientsModule,
    AppCacheModule,
    EventsModule
  ],
  controllers: [LibraryController],
  providers: [LibraryService, SearchService, LibraryRepository],
  exports: [LibraryService, SearchService],
})
export class LibraryModule {}
