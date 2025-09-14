import { Test, TestingModule } from '@nestjs/testing';
import { LibraryService } from './library.service';
import { LibraryGame } from './entities/library-game.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LibraryQueryDto, AddGameToLibraryDto } from './dto/request.dto';
import { LibraryRepository } from './repositories/library.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { CacheService } from '../cache/cache.service';
import { EventEmitterService } from '../events/event.emitter.service';

describe('LibraryService', () => {
  let service: LibraryService;
  let repository: LibraryRepository;
  let gameCatalogClient: GameCatalogClient;
  let cacheService: CacheService;
  let eventEmitter: EventEmitterService;

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

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  };

  const mockEventEmitter = {
    emitGameAddedEvent: jest.fn(),
    emitGameRemovedEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: LibraryRepository, useValue: mockLibraryRepository },
        { provide: GameCatalogClient, useValue: mockGameCatalogClient },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventEmitterService, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
    repository = module.get<LibraryRepository>(LibraryRepository);
    gameCatalogClient = module.get<GameCatalogClient>(GameCatalogClient);
    cacheService = module.get<CacheService>(CacheService);
    eventEmitter = module.get<EventEmitterService>(EventEmitterService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserLibrary', () => {
    it('should return a paginated and enriched list of games', async () => {
      const mockGames = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      const mockDetails = [{ id: 'game1', title: 'Game One' }];
      const queryDto = new LibraryQueryDto();

      mockLibraryRepository.findUserLibrary.mockResolvedValue([mockGames, 1]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(mockDetails);

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games[0].gameDetails.title).toEqual('Game One');
      expect(result.pagination.total).toBe(1);
      expect(mockLibraryRepository.findUserLibrary).toHaveBeenCalledWith('user1', queryDto);
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith(['game1']);
    });

    it('should return empty library when user has no games', async () => {
      const queryDto = new LibraryQueryDto();

      mockLibraryRepository.findUserLibrary.mockResolvedValue([[], 0]);

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games).toEqual([]);
      expect(result.pagination.total).toBe(0);
      // getGamesByIds should not be called when there are no games
      expect(mockGameCatalogClient.getGamesByIds).not.toHaveBeenCalled();
    });

    it('should handle missing game details gracefully', async () => {
      const mockGames = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      const queryDto = new LibraryQueryDto();

      mockLibraryRepository.findUserLibrary.mockResolvedValue([mockGames, 1]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails).toBeUndefined();
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('addGameToLibrary', () => {
    it('should add a game, invalidate cache, and emit an event', async () => {
      const dto: AddGameToLibraryDto = { userId: 'user1', gameId: 'game1', orderId: 'order1', purchaseId: 'purchase1', purchasePrice: 10.0, currency: 'USD', purchaseDate: new Date().toISOString() };
      const newGame = new LibraryGame();

      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(null);
      mockLibraryRepository.create.mockReturnValue(newGame);
      mockLibraryRepository.save.mockResolvedValue(newGame);

      const result = await service.addGameToLibrary(dto);

      expect(result).toEqual(newGame);
      expect(mockLibraryRepository.save).toHaveBeenCalledWith(newGame);
      expect(mockCacheService.del).toHaveBeenCalled();
      expect(mockEventEmitter.emitGameAddedEvent).toHaveBeenCalledWith(dto.userId, dto.gameId);
    });

    it('should throw a ConflictException if the game is already in the library', async () => {
      const dto: AddGameToLibraryDto = { userId: 'user1', gameId: 'game1', orderId: 'order1', purchaseId: 'purchase1', purchasePrice: 10.0, currency: 'USD', purchaseDate: new Date().toISOString() };
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(new LibraryGame());

      await expect(service.addGameToLibrary(dto)).rejects.toThrow(ConflictException);
      expect(mockCacheService.del).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitGameAddedEvent).not.toHaveBeenCalled();
    });
  });

  describe('checkGameOwnership', () => {
    it('should return true if the user owns the game', async () => {
      const mockGame = new LibraryGame();
      mockGame.purchaseDate = new Date();
      mockGame.purchasePrice = 29.99;
      mockGame.currency = 'USD';
      
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(mockGame);
      const result = await service.checkGameOwnership('user1', 'game1');
      
      expect(result.owns).toBe(true);
      expect(result.purchaseDate).toEqual(mockGame.purchaseDate);
      expect(result.purchasePrice).toBe(mockGame.purchasePrice);
      expect(result.currency).toBe(mockGame.currency);
    });

    it('should return false if the user does not own the game', async () => {
      mockLibraryRepository.findOneByUserIdAndGameId.mockResolvedValue(null);
      const result = await service.checkGameOwnership('user1', 'game1');
      expect(result.owns).toBe(false);
      expect(result.purchaseDate).toBeUndefined();
      expect(result.purchasePrice).toBeUndefined();
      expect(result.currency).toBeUndefined();
    });
  });

  describe('removeGameFromLibrary', () => {
    it('should remove a game, invalidate cache, and emit an event', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 1, raw: {} });
      await service.removeGameFromLibrary('user1', 'game1');
      expect(mockLibraryRepository.delete).toHaveBeenCalledWith({ userId: 'user1', gameId: 'game1' });
      expect(mockCacheService.del).toHaveBeenCalled();
      expect(mockEventEmitter.emitGameRemovedEvent).toHaveBeenCalledWith('user1', 'game1');
    });

    it('should throw a NotFoundException if the game is not in the library', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 0, raw: {} });
      await expect(service.removeGameFromLibrary('user1', 'game1')).rejects.toThrow(NotFoundException);
    });
  });
});
