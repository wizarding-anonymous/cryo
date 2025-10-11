import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
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
  private readonly logger = new Logger(LibraryService.name);

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
    try {
      // Validate user exists
      const userExists = await this.userServiceClient.doesUserExist(dto.userId);
      if (!userExists) {
        throw new NotFoundException(`User ${dto.userId} not found`);
      }

      // Validate game exists
      const gameExists = await this.gameCatalogClient.doesGameExist(dto.gameId);
      if (!gameExists) {
        throw new NotFoundException(`Game ${dto.gameId} not found`);
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
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Handle external service errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Service unavailable') || 
          errorMessage.includes('unavailable') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('Circuit breaker is OPEN')) {
        throw new ServiceUnavailableException(
          'External service temporarily unavailable',
        );
      }
      
      throw new InternalServerErrorException(
        'Failed to add game to library',
        errorMessage,
      );
    }
  }

  async checkGameOwnership(
    userId: string,
    gameId: string,
  ): Promise<OwnershipResponseDto> {
    // Validate UUID format before any database operations
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId)) {
      throw new BadRequestException('Invalid UUID format for gameId');
    }
    if (!uuidRegex.test(userId)) {
      throw new BadRequestException('Invalid UUID format for userId');
    }

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

    // Fetch uncached game details with graceful degradation
    if (uncachedGameIds.length > 0) {
      try {
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
      } catch (error) {
        // Graceful degradation: log error but continue without enrichment
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to enrich games with catalog data: ${errorMessage}. Returning basic library data.`,
        );
      }
    }

    return libraryGames.map((game) =>
      LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
    );
  }
}
