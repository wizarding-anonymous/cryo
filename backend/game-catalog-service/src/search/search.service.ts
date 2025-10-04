import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { SearchGamesDto } from '../dto/search-games.dto';
import { GameListResponse } from '../interfaces/game.interface';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async searchGames(searchGamesDto: SearchGamesDto): Promise<GameListResponse> {
    const {
      q,
      page,
      limit,
      searchType = 'title',
      minPrice,
      maxPrice,
    } = searchGamesDto;
    const skip = (page - 1) * limit;

    this.logger.log(
      `Searching games with query: "${q}", page: ${page}, limit: ${limit}, searchType: ${searchType}`,
    );

    try {
      const queryBuilder = this.gameRepository.createQueryBuilder('game');

      // Apply search query if provided
      if (q && q.trim()) {
        const sanitizedQuery = this.sanitizeSearchQuery(q.trim());
        this.applyFullTextSearch(queryBuilder, sanitizedQuery, searchType);
      }

      // Apply price filters if provided
      if (minPrice !== undefined) {
        queryBuilder.andWhere('game.price >= :minPrice', { minPrice });
      }

      if (maxPrice !== undefined) {
        queryBuilder.andWhere('game.price <= :maxPrice', { maxPrice });
      }

      // Only show available games
      queryBuilder
        .andWhere('game.available = :available', { available: true })
        .orderBy('game.releaseDate', 'DESC')
        .addOrderBy('game.title', 'ASC') // Secondary sort for consistent results
        .skip(skip)
        .take(limit);

      const [games, total] = await queryBuilder.getManyAndCount();

      this.logger.log(`Found ${total} games matching search criteria`);

      return {
        games,
        total,
        page,
        limit,
        hasNext: total > page * limit,
      };
    } catch (error) {
      this.logger.error(
        `Error searching games: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Return empty results on error to prevent service failure
      return {
        games: [],
        total: 0,
        page,
        limit,
        hasNext: false,
      };
    }
  }

  /**
   * Sanitizes the search query to prevent SQL injection and format for PostgreSQL full-text search
   */
  private sanitizeSearchQuery(query: string): string {
    // Remove special characters that could interfere with tsquery
    const sanitized = query
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // Keep only word characters and Cyrillic
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Split into words and join with & for AND search, add :* for prefix matching
    const words = sanitized.split(' ').filter((word) => word.length > 0);

    if (words.length === 0) {
      return '';
    }

    return words.map((word) => `${word}:*`).join(' & ');
  }

  /**
   * Applies PostgreSQL full-text search based on search type
   */
  private applyFullTextSearch(
    queryBuilder: any,
    sanitizedQuery: string,
    searchType: string,
  ): void {
    if (!sanitizedQuery) {
      return;
    }

    switch (searchType) {
      case 'title':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        queryBuilder.andWhere(
          "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
          { query: sanitizedQuery },
        );
        break;

      case 'description':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        queryBuilder.andWhere(
          "to_tsvector('russian', COALESCE(game.description, '')) @@ to_tsquery('russian', :query)",
          { query: sanitizedQuery },
        );
        break;

      case 'all':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        queryBuilder.andWhere(
          "to_tsvector('russian', game.title || ' ' || COALESCE(game.description, '') || ' ' || COALESCE(game.shortDescription, '')) @@ to_tsquery('russian', :query)",
          { query: sanitizedQuery },
        );
        break;

      default:
        // Default to title search
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        queryBuilder.andWhere(
          "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
          { query: sanitizedQuery },
        );
    }
  }
}
