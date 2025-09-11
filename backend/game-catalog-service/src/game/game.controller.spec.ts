import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { GetGamesDto } from '../dto/get-games.dto';
import { Game } from '../entities/game.entity';

const mockGameService = {
  createGame: jest.fn(),
  getAllGames: jest.fn(),
  getGameById: jest.fn(),
  updateGame: jest.fn(),
  deleteGame: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('GameController', () => {
  let controller: GameController;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: mockGameService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call gameService.createGame with the correct dto', async () => {
      const createGameDto: CreateGameDto = { title: 'New Game', price: 100 };
      const mockGame = new Game();
      mockGameService.createGame.mockResolvedValue(mockGame);

      const result = await controller.create(createGameDto);
      expect(service.createGame).toHaveBeenCalledWith(createGameDto);
      expect(result).toEqual(mockGame);
    });
  });

  describe('findAll', () => {
    it('should call gameService.getAllGames with the correct query', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10 };
      mockGameService.getAllGames.mockResolvedValue({ games: [], total: 0, page: 1, limit: 10, hasNext: false });

      await controller.findAll(getGamesDto);
      expect(service.getAllGames).toHaveBeenCalledWith(getGamesDto);
    });
  });

  describe('findOne', () => {
    it('should call gameService.getGameById with the correct id', async () => {
      const id = 'some-uuid';
      const mockGame = new Game();
      mockGameService.getGameById.mockResolvedValue(mockGame);

      const result = await controller.findOne(id);
      expect(service.getGameById).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockGame);
    });
  });

  describe('update', () => {
    it('should call gameService.updateGame with the correct id and dto', async () => {
      const id = 'some-uuid';
      const updateGameDto: UpdateGameDto = { title: 'Updated Game' };
      const mockGame = new Game();
      mockGameService.updateGame.mockResolvedValue(mockGame);

      const result = await controller.update(id, updateGameDto);
      expect(service.updateGame).toHaveBeenCalledWith(id, updateGameDto);
      expect(result).toEqual(mockGame);
    });
  });

  describe('remove', () => {
    it('should call gameService.deleteGame with the correct id', async () => {
      const id = 'some-uuid';
      mockGameService.deleteGame.mockResolvedValue(undefined);

      await controller.remove(id);
      expect(service.deleteGame).toHaveBeenCalledWith(id);
    });
  });
});
