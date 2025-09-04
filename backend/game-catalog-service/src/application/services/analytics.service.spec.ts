import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Logger } from '@nestjs/common';

// Mock the logger to spy on its methods
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let gameRepository: GameRepository;

  const mockGameRepository = {
    increment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    // Manually inject the mocked logger
    (service as any).logger = mockLogger;
    gameRepository = module.get<GameRepository>(GameRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackGameView', () => {
    it('should call increment on the repository for viewsCount', async () => {
      const gameId = 'test-id';
      await service.trackGameView(gameId);
      expect(gameRepository.increment).toHaveBeenCalledWith(gameId, 'viewsCount', 1);
      expect(mockLogger.log).toHaveBeenCalledWith(`Tracked view for game: ${gameId}`);
    });

    it('should log an error if the repository throws', async () => {
      const gameId = 'test-id';
      const error = new Error('DB error');
      mockGameRepository.increment.mockRejectedValue(error);

      await service.trackGameView(gameId);

      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to track view for game ${gameId}`, error.stack);
    });
  });

  describe('trackSale', () => {
    it('should call increment on the repository for salesCount', async () => {
      const gameId = 'test-id';
      const amount = 19.99;
      await service.trackSale(gameId, amount);
      expect(gameRepository.increment).toHaveBeenCalledWith(gameId, 'salesCount', 1);
      expect(mockLogger.log).toHaveBeenCalledWith(`Tracked sale for game: ${gameId}`);
    });

    it('should log an error if the repository throws', async () => {
        const gameId = 'test-id';
        const error = new Error('DB error');
        mockGameRepository.increment.mockRejectedValue(error);

        await service.trackSale(gameId, 19.99);

        expect(mockLogger.error).toHaveBeenCalledWith(`Failed to track sale for game ${gameId}`, error.stack);
    });
  });

  describe('trackDownload', () => {
    it('should call increment on the repository for downloadCount', async () => {
      const gameId = 'test-id';
      await service.trackDownload(gameId);
      expect(gameRepository.increment).toHaveBeenCalledWith(gameId, 'downloadCount', 1);
      expect(mockLogger.log).toHaveBeenCalledWith(`Tracked download for game: ${gameId}`);
    });

    it('should log an error if the repository throws', async () => {
        const gameId = 'test-id';
        const error = new Error('DB error');
        mockGameRepository.increment.mockRejectedValue(error);

        await service.trackDownload(gameId);

        expect(mockLogger.error).toHaveBeenCalledWith(`Failed to track download for game ${gameId}`, error.stack);
    });
  });

  describe('trackSearchQuery', () => {
    it('should log the search query and result count', async () => {
      const query = 'cyberpunk';
      const resultCount = 5;
      await service.trackSearchQuery(query, resultCount);
      expect(mockLogger.log).toHaveBeenCalledWith(`Search performed: Query='${query}', Results=${resultCount}`);
    });
  });
});
