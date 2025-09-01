import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../game.service';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { CreateGameDto } from '../../../infrastructure/http/dtos/create-game.dto';
import { Game, GameStatus } from '../../../domain/entities/game.entity';
import { NotFoundException } from '@nestjs/common';

const mockGameRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('GameService', () => {
  let service: GameService;
  let repository: typeof mockGameRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: GameRepository,
          useValue: mockGameRepository,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    repository = module.get(GameRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a game successfully', async () => {
      const createGameDto: CreateGameDto = {
        title: 'Test Game',
        price: 59.99,
        developerId: 'dev-uuid',
        isFree: false,
      };
      const expectedGame = { ...new Game(), ...createGameDto, id: 'some-uuid', slug: 'test-game' };

      repository.create.mockResolvedValue(expectedGame);

      const result = await service.create(createGameDto);
      expect(result).toEqual(expectedGame);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        ...createGameDto,
        slug: 'test-game',
      }));
    });
  });

  describe('findOne', () => {
    it('should return a game if found', async () => {
      const gameId = 'some-uuid';
      const expectedGame = { id: gameId, title: 'Found Game', status: GameStatus.PUBLISHED };
      repository.findById.mockResolvedValue(expectedGame);

      const result = await service.findOne(gameId);
      expect(result).toEqual(expectedGame);
      expect(repository.findById).toHaveBeenCalledWith(gameId);
    });

    it('should throw NotFoundException if game not found', async () => {
      const gameId = 'not-found-uuid';
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(gameId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return an array of games and total count', async () => {
        const expectedResult = { data: [{ id: '1', title: 'Game 1' }], total: 1 };
        repository.findAll.mockResolvedValue(expectedResult);

        const result = await service.findAll({ page: 1, limit: 10 });
        expect(result).toEqual(expectedResult);
        expect(repository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });
});
