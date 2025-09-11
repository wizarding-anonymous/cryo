import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { SearchGamesDto } from '../dto/search-games.dto';
import { GameListResponse } from '../interfaces/game.interface';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async searchGames(
    searchGamesDto: SearchGamesDto,
  ): Promise<GameListResponse> {
    const { q, page, limit } = searchGamesDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.gameRepository.createQueryBuilder('game');

    if (q) {
      // Use PostgreSQL's full-text search capabilities
      queryBuilder.where(
        "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
        { query: `${q.trim().split(' ').join(' & ')}:*` },
      );
    }

    queryBuilder
      .andWhere('game.available = :available', { available: true })
      .orderBy('game.releaseDate', 'DESC')
      .skip(skip)
      .take(limit);

    const [games, total] = await queryBuilder.getManyAndCount();

    return {
      games,
      total,
      page,
      limit,
      hasNext: total > page * limit,
    };
  }
}
