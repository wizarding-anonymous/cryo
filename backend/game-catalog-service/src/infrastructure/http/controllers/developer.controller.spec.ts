import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperController } from './developer.controller';
import { GameService } from '../../../application/services/game.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GameAnalyticsDto } from '../dtos/game-analytics.dto';

describe('DeveloperController', () => {
  let controller: DeveloperController;
  let gameService: GameService;

  const mockGameService = {
    findByDeveloper: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    submitForModeration: jest.fn(),
    getDeveloperGameAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeveloperController],
      providers: [
        {
          provide: GameService,
          useValue: mockGameService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeveloperController>(DeveloperController);
    gameService = module.get<GameService>(GameService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findDeveloperGames', () => {
    it('should call findByDeveloper on the service with correct parameters', async () => {
      const paginationDto = { page: 1, limit: 10 };
      const langHeader = 'de-DE';
      const developerId = 'mock-dev-id';
      mockGameService.findByDeveloper.mockResolvedValue({ data: [], total: 0 });

      await controller.findDeveloperGames(paginationDto, langHeader);

      expect(gameService.findByDeveloper).toHaveBeenCalledWith(developerId, paginationDto, langHeader);
    });
  });

  // ... (tests for other endpoints can be added here)

  describe('getGameAnalytics', () => {
    it('should call getDeveloperGameAnalytics on the service and return the result', async () => {
      const gameId = 'test-game-id';
      const developerId = 'mock-dev-id'; // As used in the controller
      const expectedResult: GameAnalyticsDto = {
        gameId,
        title: 'Test Game',
        viewsCount: 100,
        salesCount: 10,
        downloadCount: 50,
        averageRating: 4.5,
        reviewsCount: 20,
      };
      mockGameService.getDeveloperGameAnalytics.mockResolvedValue(expectedResult);

      const result = await controller.getGameAnalytics(gameId);

      expect(result).toEqual(expectedResult);
      expect(gameService.getDeveloperGameAnalytics).toHaveBeenCalledWith(gameId, developerId);
    });
  });
});
