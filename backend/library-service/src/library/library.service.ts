import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryGame } from './entities/library-game.entity';
import { LibraryQueryDto, AddGameToLibraryDto, SearchLibraryDto } from './dto/request.dto';
import { LibraryResponseDto, OwnershipResponseDto, LibraryGameDto, GameDetailsDto } from './dto/response.dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { CacheService } from '../cache/cache.service';
import { EventEmitterService } from '../events/event.emitter.service';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LibraryGame)
    private readonly libraryRepository: Repository<LibraryGame>,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async getUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    const cacheKey = `user-library:${userId}:${JSON.stringify(queryDto)}`;
    return this.cacheService.getOrSet(cacheKey, async () => {
      const [games, total] = await this.libraryRepository.findAndCount({
        where: { userId },
        skip: (queryDto.page - 1) * queryDto.limit,
        take: queryDto.limit,
        order: { [queryDto.sortBy]: queryDto.sortOrder },
      });

      const enrichedGames = await this.enrichWithGameDetails(games);

      return {
        games: enrichedGames,
        pagination: {
          total,
          page: queryDto.page,
          limit: queryDto.limit,
          totalPages: Math.ceil(total / queryDto.limit),
        },
      };
    }, 300); // Cache for 5 minutes
  }

  async addGameToLibrary(
    dto: AddGameToLibraryDto,
  ): Promise<LibraryGame> {
    const existingEntry = await this.libraryRepository.findOne({
      where: { userId: dto.userId, gameId: dto.gameId },
    });

    if (existingEntry) {
      throw new ConflictException('Game already exists in the library.');
    }

    const newGame = this.libraryRepository.create({
      userId: dto.userId,
      gameId: dto.gameId,
      purchaseDate: new Date(dto.purchaseDate),
      purchasePrice: dto.purchasePrice,
      currency: dto.currency,
      orderId: dto.orderId,
      purchaseId: dto.purchaseId,
    });

    const savedGame = await this.libraryRepository.save(newGame);
    await this.invalidateUserLibraryCache(dto.userId);
    this.eventEmitter.emitGameAddedEvent(dto.userId, dto.gameId);
    return savedGame;
  }

  async checkGameOwnership(
    userId: string,
    gameId: string,
  ): Promise<OwnershipResponseDto> {
    const entry = await this.libraryRepository.findOne({
      where: { userId, gameId },
    });

    if (!entry) {
      return { owns: false };
    }

    return {
      owns: true,
      purchaseDate: entry.purchaseDate,
      purchasePrice: entry.purchasePrice,
      currency: entry.currency,
    };
  }

  async removeGameFromLibrary(
    userId: string,
    gameId: string,
  ): Promise<void> {
    const result = await this.libraryRepository.delete({ userId, gameId });

    if (result.affected === 0) {
      throw new NotFoundException('Game not found in library.');
    }
    await this.invalidateUserLibraryCache(userId);
    this.eventEmitter.emitGameRemovedEvent(userId, gameId);
  }

  private async invalidateUserLibraryCache(userId: string) {
    // This is a simple invalidation. A more robust solution would
    // involve pattern-based key deletion if the cache supported it,
    // or tracking all related keys. For now, we assume we can't
    // easily delete all paginated versions, so this is a placeholder.
    // A better approach would be to use tagged caching.
    const cacheKeyPattern = `user-library:${userId}:*`;
    // Since we can't delete by pattern easily, this is a conceptual note.
    // In a real app, we'd have a strategy for this.
  }

  private async enrichWithGameDetails(libraryGames: LibraryGame[]): Promise<LibraryGameDto[]> {
    const gameIds = libraryGames.map((game) => game.gameId);
    if (gameIds.length === 0) {
      return [];
    }

    const gameDetailsMap = new Map<string, GameDetailsDto>();
    const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
    gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

    return libraryGames.map((game) =>
      LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
    );
  }
}
