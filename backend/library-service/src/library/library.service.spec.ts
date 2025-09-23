import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LibraryService } from './library.service';
import { LibraryRepository } from './repositories/library.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { UserServiceClient } from '../clients/user.client';
import { CacheService } from '../cache/cache.service';
import { EventEmitterService } from '../events/event.emitter.service';
import { HistoryService } from '../history/history.service';
import { LibraryQueryDto, AddGameToLibraryDto } from './dto';
import { SortBy } from '../common/enums';
import { LibraryGame } from '../entities/library-game.entity';

interface MinimalGameDetails {
  id: string;
  title?: string;
}

describe('LibraryService', () => {
  let service: LibraryService;

  const mockLibraryRepository = {
    findUserLibrary: jest.fn(),
    findOneByUserIdAndGameId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
  };

  const mockUserServiceClient = {
    doesUserExist: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
    getCachedLibraryData: jest.fn().mockImplementation(async (_userId, _cacheKey, fetchFn) => {
      return await fetchFn();
    }),
    invalidateUserLibraryCache: jest.fn(),
    mget: jest.fn().mockResolvedValue(new Map()),
    mset: jest.fn(),
    recordUserCacheKey: jest.fn(),
  };

  const mockEventEmitter = {
    emitGameAddedEvent: jest.fn(),
    emitGameRemovedEvent: jest.fn(),
  };

  const mockHistoryService = {
    createPurchaseRecord: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: LibraryRepository, useValue: mockLibraryRepository },
        { provide: GameCatalogClient, useValue: mockGameCatalogClient },
        { provide: UserServiceClient, useValue: mockUserServiceClient },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventEmitterService, useValue: mockEventEmitter },
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);

    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.del.mockResolvedValue(undefined);
    mockCacheService.getOrSet.mockImplementation(
      async (_key: string, fn: () => Promise<any>) => fn(),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserLibrary', () => {
    it('returns a paginated and enriched list of games', async () => {
      const mockGames = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      const mockDetails: MinimalGameDetails[] = [
        { id: 'game1', title: 'Game One' },
      ];
      const queryDto = new LibraryQueryDto();

      mockLibraryRepository.findUserLibrary.mockResolvedValue([mockGames, 1]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(mockDetails);

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games).toHaveLength(1);
      const firstGame = result.games[0];
      expect(firstGame.gameDetails).toBeDefined();
      expect(firstGame.gameDetails?.title).toEqual('Game One');
      expect(result.pagination.total).toBe(1);
      expect(mockLibraryRepository.findUserLibrary).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          page: 1,
          limit: 20,
          sortBy: SortBy.PURCHASE_DATE,
          sortOrder: 'desc',
        }),
      );
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith([
        'game1',
      ]);
    });

    it('returns empty library when user has no games', async () => {
      const queryDto = new LibraryQueryDto();
      mockLibraryRepository.findUserLibrary.mockResolvedValue([[], 0]);

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(mockGameCatalogClient.getGamesByIds).not.toHaveBeenCalled();
    });

    it('handles missing game details gracefully', async () => {
      const mockGames = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      mockLibraryRepository.findUserLibrary.mockResolvedValue([mockGames, 1]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const result = await service.getUserLibrary(
        'user1',
        new LibraryQueryDto(),
      );

      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails).toBeUndefined();
      expect(result.pagination.total).toBe(1);
    });

    it('delegates to cache layer when retrieving data', async () => {
      const cachedResponse = {
        games: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockCacheService.getCachedLibraryData.mockResolvedValue(cachedResponse);

      const result = await service.getUserLibrary(
        'user1',
        new LibraryQueryDto(),
      );

      expect(mockCacheService.getCachedLibraryData).toHaveBeenCalled();
      expect(result).toBe(cachedResponse);
    });
  });

  describe('addGameToLibrary', () => {
    const dto: AddGameToLibraryDto = {
      userId: 'user1',
      gameId: 'game1',
      orderId: 'order1',
      purchaseId: 'purchase1',
      purchasePrice: 10,
      currency: 'USD',
      purchaseDate: new Date().toISOString(),
    };

    it('adds a game, invalidates cache, and emits an event', async () => {
      const newGame = new LibraryGame();
      mockUserServiceClient.doesUserExist.mockResolvedValue(true);
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(null);
      mockLibraryRepository.create.mockReturnValue(newGame);
      mockLibraryRepository.save.mockResolvedValue(newGame);
      mockHistoryService.createPurchaseRecord.mockResolvedValue({});

      const result = await service.addGameToLibrary(dto);

      expect(result).toEqual(newGame);
      expect(mockHistoryService.createPurchaseRecord).toHaveBeenCalledWith(dto);
      expect(mockEventEmitter.emitGameAddedEvent).toHaveBeenCalledWith(
        dto.userId,
        dto.gameId,
      );
    });

    it('throws a ConflictException if the game already exists', async () => {
      mockUserServiceClient.doesUserExist.mockResolvedValue(true);
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(
        new LibraryGame(),
      );

      await expect(service.addGameToLibrary(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockEventEmitter.emitGameAddedEvent).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if user does not exist', async () => {
      mockUserServiceClient.doesUserExist.mockResolvedValue(false);

      await expect(service.addGameToLibrary(dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockLibraryRepository.findOneByUserIdAndGameId,
      ).not.toHaveBeenCalled();
    });
  });

  describe('checkGameOwnership', () => {
    it('returns ownership details for owned game', async () => {
      const mockGame = new LibraryGame();
      mockGame.purchaseDate = new Date();
      mockGame.purchasePrice = 29.99;
      mockGame.currency = 'USD';
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(
        mockGame,
      );

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toEqual({
        owns: true,
        purchaseDate: mockGame.purchaseDate,
        purchasePrice: mockGame.purchasePrice,
        currency: mockGame.currency,
      });
    });

    it('returns owns: false when game not found', async () => {
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(null);

      const result = await service.checkGameOwnership('user1', 'game1');
      expect(result).toEqual({ owns: false });
    });
  });

  describe('removeGameFromLibrary', () => {
    it('removes a game and emits removal event', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.removeGameFromLibrary('user1', 'game1');

      expect(mockLibraryRepository.delete).toHaveBeenCalledWith({
        userId: 'user1',
        gameId: 'game1',
      });
      expect(mockEventEmitter.emitGameRemovedEvent).toHaveBeenCalledWith(
        'user1',
        'game1',
      );
    });

    it('throws NotFoundException when delete affects no rows', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(
        service.removeGameFromLibrary('user1', 'game1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
