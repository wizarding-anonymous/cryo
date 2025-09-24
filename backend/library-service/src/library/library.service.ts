import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { LibraryGame } from '../entities/library-game.entity';
import {
  LibraryQueryDto,
  AddGameToLibraryDto,
  LibraryResponseDto,
  OwnershipResponseDto,
  LibraryGameDto,
  GameDetailsDto,
} from './dto';
import { SortBy } from '../common/enums';
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
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const cacheKey = `library_${userId}_page_${page}_limit_${limit}_${sortBy}_${sortOrder}`;

    const fetchFn = async (): Promise<LibraryResponseDto> => {
      const [games, total] = await this.libraryRepository.findUserLibrary(
        userId,
        {
          ...queryDto,
          page,
          limit,
          sortBy,
          sortOrder,
        },
      );
      const enrichedGames = await this.enrichWithGameDetails(games);
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      return {
        games: enrichedGames,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    };

    return await this.cacheService.getCachedLibraryData<LibraryResponseDto>(
      userId,
      cacheKey,
      fetchFn,
    );
  }

  async addGameToLibrary(dto: AddGameToLibraryDto): Promise<LibraryGame> {
    const userExists = await this.userServiceClient.doesUserExist(dto.userId);
    if (!userExists) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    const existingEntry = await this.libraryRepository.findOneByUserIdAndGameId(
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
    await this.historyService.createPurchaseRecord(dto);
    await this.invalidateUserLibraryCache(dto.userId);
    await this.eventEmitter.emitGameAddedEvent(dto.userId, dto.gameId);
    return savedGame;
  }

  async checkGameOwnership(
    userId: string,
    gameId: string,
  ): Promise<OwnershipResponseDto> {
    const cacheKey = `ownership_${userId}_${gameId}`;

    const fetchFn = async (): Promise<OwnershipResponseDto> => {
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
        purchasePrice: Number(entry.purchasePrice),
        currency: entry.currency,
      };
    };

    return await this.cacheService.getOrSet<OwnershipResponseDto>(
      cacheKey,
      fetchFn,
      180, // 3 minutes TTL for ownership checks
    );
  }

  async removeGameFromLibrary(userId: string, gameId: string): Promise<void> {
    const result = await this.libraryRepository.delete({ userId, gameId });

    if (result.affected === 0) {
      throw new NotFoundException('Game not found in library.');
    }
    await this.invalidateUserLibraryCache(userId);
    await this.eventEmitter.emitGameRemovedEvent(userId, gameId);
  }

  private async invalidateUserLibraryCache(userId: string): Promise<void> {
    await this.cacheService.invalidateUserLibraryCache(userId);
  }

  private async enrichWithGameDetails(
    libraryGames: LibraryGame[],
  ): Promise<LibraryGameDto[]> {
    const gameIds = libraryGames.map((game) => game.gameId);
    if (gameIds.length === 0) {
      return [];
    }

    const gameDetailsMap = new Map<string, GameDetailsDto>();

    // Try to get cached game details first
    const cachedDetails = await this.cacheService.mget<GameDetailsDto>(
      gameIds.map((id) => `game_details_${id}`),
    );

    // Collect uncached game IDs
    const uncachedGameIds: string[] = [];
    gameIds.forEach((gameId) => {
      const cacheKey = `game_details_${gameId}`;
      const cached = cachedDetails.get(cacheKey);
      if (cached) {
        gameDetailsMap.set(gameId, cached);
      } else {
        uncachedGameIds.push(gameId);
      }
    });

    // Fetch uncached game details
    if (uncachedGameIds.length > 0) {
      const gameDetails =
        await this.gameCatalogClient.getGamesByIds(uncachedGameIds);

      // Cache the fetched details and add to map
      const cacheEntries = gameDetails.map((detail) => ({
        key: `game_details_${detail.id}`,
        value: detail,
        ttl: 1800, // 30 minutes for game details
      }));

      await this.cacheService.mset(cacheEntries);

      gameDetails.forEach((detail) => {
        gameDetailsMap.set(detail.id, detail);
      });
    }

    return libraryGames.map((game) =>
      LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
    );
  }
}
