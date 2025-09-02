import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../game.service';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { CategoryRepository } from '../../../infrastructure/persistence/category.repository';
import { TagRepository } from '../../../infrastructure/persistence/tag.repository';
import { SearchService } from '../search.service';
import { AnalyticsService } from '../analytics.service';
import { EventPublisherService } from '../event-publisher.service';
import { CreateGameDto } from '../../../infrastructure/http/dtos/create-game.dto';
import { Game, GameStatus } from '../../../domain/entities/game.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockGameRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findByDeveloper: jest.fn(),
  findByStatus: jest.fn(),
};

const mockCategoryRepository = {
  findByIds: jest.fn(),
};

const mockTagRepository = {
  findByIds: jest.fn(),
};

const mockSearchService = {
  indexGame: jest.fn(),
  removeGame: jest.fn(),
};

const mockAnalyticsService = {
  trackGameView: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn(),
};

const mockCacheManager = {
  store: {
    keys: jest.fn(),
    del: jest.fn(),
  },
};

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: CategoryRepository, useValue: mockCategoryRepository },
        { provide: TagRepository, useValue: mockTagRepository },
        { provide: SearchService, useValue: mockSearchService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a game with unique slug and relations', async () => {
      const dto: CreateGameDto = { title: 'New Game', price: 10, developerId: 'dev1', isFree: false, categoryIds: ['cat1'], tagIds: ['tag1'] };
      const game = { ...new Game(), ...dto };

      mockGameRepository.findBySlug.mockResolvedValue(null); // Slug is unique
      mockCategoryRepository.findByIds.mockResolvedValue([{ id: 'cat1', name: 'Action' }]);
      mockTagRepository.findByIds.mockResolvedValue([{ id: 'tag1', name: 'Indie' }]);
      mockGameRepository.create.mockResolvedValue(game);

      await service.create(dto, 'dev1');

      expect(mockGameRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'new-game',
        categories: expect.any(Array),
        tags: expect.any(Array),
      }));
      expect(mockSearchService.indexGame).toHaveBeenCalled();
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
    });

    it('should generate a unique slug if the initial slug exists', async () => {
        const dto: CreateGameDto = { title: 'Existing Game', price: 10, developerId: 'dev1', isFree: false };

        mockGameRepository.findBySlug.mockResolvedValueOnce({ id: '1', title: 'Existing Game', slug: 'existing-game' }); // First slug exists
        mockGameRepository.findBySlug.mockResolvedValueOnce(null); // Second slug is unique
        mockGameRepository.create.mockResolvedValue({} as Game);

        await service.create(dto, 'dev1');

        expect(mockGameRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          slug: 'existing-game-1',
        }));
      });
  });

  describe('update', () => {
    it('should update a game', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const existingGame = { id: gameId, developerId: devId, title: 'Old Title' } as Game;
        const updateDto = { title: 'New Title' };

        mockGameRepository.findById.mockResolvedValue(existingGame);
        mockGameRepository.save.mockResolvedValue({ ...existingGame, ...updateDto });

        await service.update(gameId, updateDto, devId);

        expect(mockGameRepository.save).toHaveBeenCalled();
        expect(mockSearchService.indexGame).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if developer is not the owner', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const otherDevId = 'dev2';
        const existingGame = { id: gameId, developerId: otherDevId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await expect(service.update(gameId, {}, devId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove a game', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const existingGame = { id: gameId, developerId: devId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await service.remove(gameId, devId);

        expect(mockGameRepository.remove).toHaveBeenCalledWith(existingGame);
        expect(mockSearchService.removeGame).toHaveBeenCalledWith(gameId);
    });

    it('should throw ForbiddenException if developer does not own the game on remove', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const otherDevId = 'dev2';
        const existingGame = { id: gameId, developerId: otherDevId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await expect(service.remove(gameId, devId)).rejects.toThrow(ForbiddenException);
    });
  });


  describe('approveGame', () => {
    it('should approve a game and publish an event', async () => {
        const gameId = 'game1';
        const game = { id: gameId, status: GameStatus.PENDING_REVIEW } as Game;

        mockGameRepository.findById.mockResolvedValue(game);
        mockGameRepository.save.mockResolvedValue({ ...game, status: GameStatus.PUBLISHED });

        const result = await service.approveGame(gameId);

        expect(result.status).toBe(GameStatus.PUBLISHED);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith({
            type: 'game.approved',
            payload: { gameId: gameId },
        });
    });
  });

  describe('rejectGame', () => {
    it('should reject a game and publish an event', async () => {
        const gameId = 'game1';
        const reason = 'Not appropriate';
        const game = { id: gameId, status: GameStatus.PENDING_REVIEW } as Game;

        mockGameRepository.findById.mockResolvedValue(game);
        mockGameRepository.save.mockResolvedValue({ ...game, status: GameStatus.REJECTED });

        const result = await service.rejectGame(gameId, reason);

        expect(result.status).toBe(GameStatus.REJECTED);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith({
            type: 'game.rejected',
            payload: { gameId: gameId, reason },
        });
    });
  });
});
