import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { SearchService } from './search.service';
import { EventPublisherService } from './event-publisher.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';

describe('ModerationService', () => {
  let service: ModerationService;
  let gameRepository: GameRepository;
  let searchService: SearchService;
  let eventPublisher: EventPublisherService;
  let cacheManager: any;

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
    searchService = module.get<SearchService>(SearchService);
    eventPublisher = module.get<EventPublisherService>(EventPublisherService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getModerationQueue', () => {
    it('should return a paginated list of games pending review', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const expectedResult = { data: [new Game()], total: 1 };
      mockGameRepository.findByStatus.mockResolvedValue(expectedResult);

      const result = await service.getModerationQueue(paginationDto);

      expect(result).toEqual(expectedResult);
      expect(mockGameRepository.findByStatus).toHaveBeenCalledWith(GameStatus.PENDING_REVIEW, paginationDto);
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
      expect(mockGameRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: GameStatus.PUBLISHED }));
      expect(mockSearchService.indexGame).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        type: 'game.approved',
        payload: { gameId },
      });
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
    });

    it('should throw NotFoundException if game not found', async () => {
      mockGameRepository.findById.mockResolvedValue(null);
      await expect(service.approveGame('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game is not pending review', async () => {
      const game = { id: 'some-id', status: GameStatus.PUBLISHED } as Game;
      mockGameRepository.findById.mockResolvedValue(game);
      await expect(service.approveGame('some-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if automatic checks fail', async () => {
        const game = { id: 'some-id', status: GameStatus.PENDING_REVIEW, title: 'bad word1 game' } as Game;
        mockGameRepository.findById.mockResolvedValue(game);
        await expect(service.approveGame('some-id')).rejects.toThrow(BadRequestException);
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
      expect(result.moderationNotes).toBe(reason);
      expect(mockGameRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: GameStatus.REJECTED }));
      expect(mockSearchService.indexGame).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        type: 'game.rejected',
        payload: { gameId, reason },
      });
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
    });

    it('should throw NotFoundException if game not found', async () => {
        mockGameRepository.findById.mockResolvedValue(null);
        await expect(service.rejectGame('non-existent-id', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game is not pending review', async () => {
        const game = { id: 'some-id', status: GameStatus.DRAFT } as Game;
        mockGameRepository.findById.mockResolvedValue(game);
        await expect(service.rejectGame('some-id', 'reason')).rejects.toThrow(BadRequestException);
    });
  });
});
