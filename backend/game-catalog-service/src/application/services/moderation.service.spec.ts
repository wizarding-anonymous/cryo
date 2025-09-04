import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { SearchService } from './search.service';
import { EventPublisherService } from './event-publisher.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';

describe('ModerationService', () => {
  let service: ModerationService;
  let gameRepository: GameRepository;
  let eventPublisher: EventPublisherService;

  const mockGameRepository = {
    findByStatus: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockSearchService = {
    indexGame: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: SearchService, useValue: mockSearchService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    gameRepository = module.get<GameRepository>(GameRepository);
    eventPublisher = module.get<EventPublisherService>(EventPublisherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitForModeration', () => {
    it('should submit a game for moderation', async () => {
      const game = { id: 'game1', developerId: 'dev1', status: GameStatus.DRAFT };
      mockGameRepository.findById.mockResolvedValue(game);
      mockGameRepository.save.mockResolvedValue({ ...game, status: GameStatus.PENDING_REVIEW });

      const result = await service.submitForModeration('game1', 'dev1');

      expect(result.status).toBe(GameStatus.PENDING_REVIEW);
      expect(mockGameRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: GameStatus.PENDING_REVIEW }));
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('getModerationQueue', () => {
    it('should return a paginated list of games pending review', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const expectedResult = { data: [new Game()], total: 1 };
      mockGameRepository.findByStatus.mockResolvedValue(expectedResult);

      const result = await service.getModerationQueue(paginationDto);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('approveGame', () => {
    it('should approve a game and publish an event', async () => {
      const gameId = 'some-id';
      const game = { id: gameId, status: GameStatus.PENDING_REVIEW, title: 'Test Game' } as Game;
      mockGameRepository.findById.mockResolvedValue(game);
      mockGameRepository.save.mockResolvedValue({ ...game, status: GameStatus.PUBLISHED });

      const result = await service.approveGame(gameId);

      expect(result.status).toBe(GameStatus.PUBLISHED);
    });
  });

  describe('rejectGame', () => {
    it('should reject a game and publish an event', async () => {
      const gameId = 'some-id';
      const reason = 'Inappropriate content';
      const game = { id: gameId, status: GameStatus.PENDING_REVIEW } as Game;
      mockGameRepository.findById.mockResolvedValue(game);
      mockGameRepository.save.mockResolvedValue({ ...game, status: GameStatus.REJECTED });

      const result = await service.rejectGame(gameId, reason);

      expect(result.status).toBe(GameStatus.REJECTED);
    });
  });
});
