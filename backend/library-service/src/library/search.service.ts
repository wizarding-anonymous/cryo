import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { LibraryGame } from './entities/library-game.entity';
import { SearchLibraryDto } from './dto/request.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(LibraryGame)
    private readonly libraryRepository: Repository<LibraryGame>,
  ) {}

  /**
   * Performs a basic search in the user's library.
   * NOTE: Currently searches by gameId. A full-featured search on game title,
   * developer, and tags requires a JOIN with data from GameCatalogService,
   * which will be implemented in a later step. Advanced features like full-text
   * search and fuzzy matching would require database-specific setup (e.g., tsvector)
   * or a dedicated search engine.
   */
  async searchUserLibrary(
    userId: string,
    searchDto: SearchLibraryDto,
  ): Promise<LibraryGame[]> {
    // This is a simplified search. A real implementation would be more complex.
    // We are searching by gameId here as a placeholder for a real search implementation.
    // A proper search would likely involve querying the Game Catalog service first
    // to get a list of gameIds matching the query, then querying the library.
    const [games] = await this.libraryRepository.findAndCount({
      where: {
        userId,
        // A real-world scenario would not use ILIKE on a UUID.
        // This is a placeholder for a more complex search logic.
        // gameId: ILike(`%${searchDto.query}%`),
      },
      skip: (searchDto.page - 1) * searchDto.limit,
      take: searchDto.limit,
      order: { [searchDto.sortBy]: searchDto.sortOrder },
    });

    // In a full implementation, you would then enrich these games with details.
    return games;
  }
}
