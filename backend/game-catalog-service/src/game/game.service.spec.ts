/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from '../entities/game.entity';
import { GetGamesDto } from '../dto/get-games.dto';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { PurchaseInfoDto } from '../dto/purchase-info.dto';
import { CacheService } from '../common/services/cache.service';

// Mock TypeORM repository
const mockGameRepository = () => ({
  findAndCount: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  preload: jest.fn(),
  delete: jest.fn(),
});

// Mock CacheService
const mockCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
  invalidateGameCache: jest.fn(),
  warmUpCache: jest.fn(),
  getCacheStats: jest.fn(),
});

describe('GameService', () => {
  let service: GameService;
  let repository: Repository<Game>;
  let cacheService: CacheService;

  const mockGame = new Game();
  mockGame.id = 'some-uuid';
  mockGame.title = 'Test Game';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useFactory: mockGameRepository,
        },
        {
          provide: CacheService,
          useFactory: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    repository = module.get<Repository<Game>>(getRepositoryToken(Game));
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllGames', () => {
    it('should return a paginated list of games with default filters', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10 };
      (repository.findAndCount as jest.Mock).mockResolvedValue([[mockGame], 1]);

      const result = await service.getAllGames(getGamesDto);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { available: true },
        take: 10,
        skip: 0,
        order: { releaseDate: 'DESC' },
      });
      expect(result.total).toBe(1);
      expect(result.games[0]).toEqual(mockGame);
    });

    it('should apply genre filter when provided', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10, genre: 'Action' };
      (repository.findAndCount as jest.Mock).mockResolvedValue([[mockGame], 1]);

      await service.getAllGames(getGamesDto);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { available: true, genre: 'Action' },
        take: 10,
        skip: 0,
        order: { releaseDate: 'DESC' },
      });
    });

    it('should apply custom sorting when provided', async () => {
      const getGamesDto: GetGamesDto = {
        page: 1,
        limit: 10,
        sortBy: 'title',
        sortOrder: 'ASC',
      };
      (repository.findAndCount as jest.Mock).mockResolvedValue([[mockGame], 1]);

      await service.getAllGames(getGamesDto);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { available: true },
        take: 10,
        skip: 0,
        order: { title: 'ASC' },
      });
    });

    it('should allow filtering by availability when explicitly set', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10, available: false };
      (repository.findAndCount as jest.Mock).mockResolvedValue([[mockGame], 1]);

      await service.getAllGames(getGamesDto);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { available: false },
        take: 10,
        skip: 0,
        order: { releaseDate: 'DESC' },
      });
    });
  });

  describe('getGameById', () => {
    it('should return a game if it exists and is available', async () => {
      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);
      const result = await service.getGameById('some-uuid');
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 'some-uuid',
        available: true,
      });
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException if game does not exist', async () => {
      (repository.findOneBy as jest.Mock)
        .mockResolvedValueOnce(null) // First call for available game
        .mockResolvedValueOnce(null); // Second call for any game

      await expect(service.getGameById('bad-uuid')).rejects.toThrow(
        new NotFoundException('Game with ID "bad-uuid" not found'),
      );
    });

    it('should throw NotFoundException with specific message if game exists but is unavailable', async () => {
      const unavailableGame = { ...mockGame, available: false };
      (repository.findOneBy as jest.Mock)
        .mockResolvedValueOnce(null) // First call for available game
        .mockResolvedValueOnce(unavailableGame); // Second call for any game

      await expect(service.getGameById('unavailable-uuid')).rejects.toThrow(
        new NotFoundException(
          'Game with ID "unavailable-uuid" is currently unavailable',
        ),
      );
    });
  });

  describe('getGameDetails', () => {
    it('should call getGameById with the provided id', async () => {
      const getByIdSpy = jest
        .spyOn(service, 'getGameById')
        .mockResolvedValue(mockGame);
      const result = await service.getGameDetails('some-uuid');
      expect(getByIdSpy).toHaveBeenCalledWith('some-uuid');
      expect(result).toEqual(mockGame);
    });
  });

  describe('getGamePurchaseInfo', () => {
    it('should return a PurchaseInfoDto for an existing game', async () => {
      const game = new Game();
      game.id = 'some-uuid';
      game.title = 'Test Game';
      game.price = 9.99;
      game.currency = 'USD';
      game.available = true;

      const getByIdSpy = jest
        .spyOn(service, 'getGameById')
        .mockResolvedValue(game);
      const result = await service.getGamePurchaseInfo('some-uuid');

      expect(getByIdSpy).toHaveBeenCalledWith('some-uuid');
      expect(result).toBeInstanceOf(PurchaseInfoDto);
      expect(result.id).toEqual(game.id);
      expect(result.title).toEqual(game.title);
      expect(result.price).toEqual(game.price);
      expect(result.available).toBe(true);
    });

    it('should throw NotFoundException if game is not available for purchase', async () => {
      const game = new Game();
      game.id = 'some-uuid';
      game.title = 'Test Game';
      game.price = 9.99;
      game.currency = 'USD';
      game.available = false;

      const getByIdSpy = jest
        .spyOn(service, 'getGameById')
        .mockResolvedValue(game);

      await expect(service.getGamePurchaseInfo('some-uuid')).rejects.toThrow(
        new NotFoundException(
          'Game with ID "some-uuid" is not available for purchase',
        ),
      );
      expect(getByIdSpy).toHaveBeenCalledWith('some-uuid');
    });

    it('should re-throw NotFoundException if getGameById throws it', async () => {
      jest
        .spyOn(service, 'getGameById')
        .mockRejectedValue(new NotFoundException());
      await expect(service.getGamePurchaseInfo('bad-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createGame', () => {
    it('should create and return a new game', async () => {
      const createGameDto: CreateGameDto = { title: 'New Game', price: 100 };
      (repository.create as jest.Mock).mockReturnValue(createGameDto);
      (repository.save as jest.Mock).mockResolvedValue(mockGame);
      (cacheService.invalidateGameCache as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.createGame(createGameDto);
      expect(repository.create).toHaveBeenCalledWith(createGameDto);
      expect(repository.save).toHaveBeenCalledWith(createGameDto);
      expect(cacheService.invalidateGameCache).toHaveBeenCalledWith();
      expect(result).toEqual(mockGame);
    });
  });

  describe('updateGame', () => {
    it('should update and return the game', async () => {
      const updateGameDto: UpdateGameDto = { title: 'Updated Title' };
      (repository.preload as jest.Mock).mockResolvedValue(mockGame);
      (repository.save as jest.Mock).mockResolvedValue(mockGame);
      (cacheService.invalidateGameCache as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.updateGame('some-uuid', updateGameDto);

      expect(repository.save).toHaveBeenCalledWith(mockGame);
      expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
        'some-uuid',
      );
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException if game to update does not exist', async () => {
      const updateGameDto: UpdateGameDto = { title: 'Updated Title' };
      (repository.preload as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateGame('bad-uuid', updateGameDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteGame', () => {
    it('should delete a game successfully', async () => {
      (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      (cacheService.invalidateGameCache as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.deleteGame('some-uuid');

      expect(repository.delete).toHaveBeenCalledWith('some-uuid');
      expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
        'some-uuid',
      );
    });

    it('should throw NotFoundException if game to delete does not exist', async () => {
      (repository.delete as jest.Mock).mockResolvedValue({ affected: 0 });
      await expect(service.deleteGame('bad-uuid')).rejects.toThrow(
        NotFoundException,
      );
      // Cache should not be invalidated if delete failed
      expect(cacheService.invalidateGameCache).not.toHaveBeenCalled();
    });
  });
});
