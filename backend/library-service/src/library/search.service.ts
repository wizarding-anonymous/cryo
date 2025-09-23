import { Injectable } from '@nestjs/common';
import { LibraryRepository } from './repositories/library.repository';
import { SearchLibraryDto } from './dto/request.dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { LibraryResponseDto, LibraryGameDto, GameDetailsDto } from './dto/response.dto';
import { LibraryGame } from './entities/library-game.entity';

@Injectable()
export class SearchService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
  ) {}

  async searchUserLibrary(
    userId: string,
    searchDto: SearchLibraryDto,
  ): Promise<LibraryResponseDto> {
    const page = searchDto.page ?? 1;
    const limit = searchDto.limit ?? 20;

    const allLibraryGames = await this.libraryRepository.find({ where: { userId } });
    if (allLibraryGames.length === 0) {
      return { games: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }

    const gameIds = allLibraryGames.map((game) => game.gameId);
    const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
    const gameDetailsMap = new Map<string, GameDetailsDto>();
    gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

    const enrichedLibraryGames = allLibraryGames.map((game) =>
      LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
    );

    const query = searchDto.query.toLowerCase();
    const filteredGames = enrichedLibraryGames.filter((game) => {
      if (!game.gameDetails) {
        return false;
      }
      const title = game.gameDetails.title?.toLowerCase() ?? '';
      const developer = game.gameDetails.developer?.toLowerCase() ?? '';
      const publisher = game.gameDetails.publisher?.toLowerCase() ?? '';
      return title.includes(query) || developer.includes(query) || publisher.includes(query);
    });

    const total = filteredGames.length;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    const startIndex = (page - 1) * limit;
    const paginatedGames = filteredGames.slice(startIndex, startIndex + limit);

    return {
      games: paginatedGames,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
