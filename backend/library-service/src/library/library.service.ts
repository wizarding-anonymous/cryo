import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { LibraryGame } from './entities/library-game.entity';
import { LibraryQueryDto, AddGameToLibraryDto } from './dto/request.dto';
import { LibraryResponseDto, OwnershipResponseDto, LibraryGameDto, GameDetailsDto } from './dto/response.dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { UserServiceClient } from '../clients/user.client';
import { CacheService } from '../cache/cache.service';
import { EventEmitterService } from '../events/event.emitter.service';
import { HistoryService } from '../history/history.service';
import { LibraryRepository } from './repositories/library.repository';

@Injectable()
export class LibraryService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly userServiceClient: UserServiceClient,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitterService,
    private readonly historyService: HistoryService,
  ) {}

  async getUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    // Build deterministic cache key expected by tests
    const cacheKey = `library_${userId}_page_${queryDto.page ?? 1}_limit_${
      queryDto.limit ?? 20
    }_${queryDto.sortBy ?? 'purchaseDate'}_${queryDto.sortOrder ?? 'desc'}`;

    const fetchFn = async (): Promise<LibraryResponseDto> => {
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
    };

    const cached = await this.cacheService.getOrSet<LibraryResponseDto>(
      cacheKey,
      fetchFn,
      300,
    );
    // Track service-level cache key per user for proper invalidation after mutations
    await this.recordUserCacheKey(userId, cacheKey);
    // In case cache layer returns undefined (e.g., not mocked in tests), fall back to direct fetch
    return cached ?? (await fetchFn());
  }

  private async recordUserCacheKey(userId: string, key: string): Promise<void> {
    const userCacheKeysKey = `user-cache-keys:${userId}`;
    const userKeys = (await this.cacheService.get<string[]>(userCacheKeysKey)) || [];
    if (!userKeys.includes(key)) {
      userKeys.push(key);
      await this.cacheService.set(userCacheKeysKey, userKeys, 0);
    }
  }

  async addGameToLibrary(
    dto: AddGameToLibraryDto,
  ): Promise<LibraryGame> {
    // Verify user exists according to spec (integration with User Service)
    const userExists = await this.userServiceClient.doesUserExist(dto.userId);
    if (!userExists) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

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
    // Record purchase history entry per spec
    await this.historyService.createPurchaseRecord(dto);
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
      purchasePrice: typeof entry.purchasePrice === 'string' ? parseFloat(entry.purchasePrice as unknown as string) : (entry.purchasePrice as any),
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
