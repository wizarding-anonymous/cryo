import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { LibraryGame } from './entities/library-game.entity';
import { LibraryQueryDto, AddGameToLibraryDto } from './dto/request.dto';
import { LibraryResponseDto, OwnershipResponseDto, LibraryGameDto, GameDetailsDto } from './dto/response.dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { CacheService } from '../cache/cache.service';
import { EventEmitterService } from '../events/event.emitter.service';
import { LibraryRepository } from './repositories/library.repository';

@Injectable()
export class LibraryService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async getUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    const [games, total] = await this.libraryRepository.findUserLibrary(
      userId,
      queryDto,
    );

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
  }

  async addGameToLibrary(
    dto: AddGameToLibraryDto,
  ): Promise<LibraryGame> {
    const existingEntry =
      await this.libraryRepository.findOneByUserIdAndGameId(
        dto.userId,
        dto.gameId,
      );

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
    const entry = await this.libraryRepository.findOneByUserIdAndGameId(
      userId,
      gameId,
    );

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
    const userCacheKeysKey = `user-cache-keys:${userId}`;
    const keysToDelete = await this.cacheService.get<string[]>(userCacheKeysKey);

    if (keysToDelete && keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        await this.cacheService.del(key);
      }
    }

    await this.cacheService.del(userCacheKeysKey);
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
