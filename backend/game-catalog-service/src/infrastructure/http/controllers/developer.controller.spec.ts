import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperController } from './developer.controller';
import { GameService } from '../../../application/services/game.service';
import { ModerationService } from '../../../application/services/moderation.service';
import { VersionService } from '../../../application/services/version.service';
import { RequirementsService } from '../../../application/services/requirements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { GameAnalyticsDto } from '../dtos/game-analytics.dto';
import { CreateVersionDto } from '../dtos/create-version.dto';
import { SystemRequirements } from '../../../domain/entities/system-requirements.entity';

describe('DeveloperController', () => {
  let controller: DeveloperController;
  let gameService: GameService;
  let moderationService: ModerationService;
  let versionService: VersionService;
  let requirementsService: RequirementsService;

  const mockGameService = {
    findByDeveloper: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getDeveloperGameAnalytics: jest.fn(),
  };

  const mockModerationService = {
    submitForModeration: jest.fn(),
  };

  const mockVersionService = {
    createVersion: jest.fn(),
    getVersionHistory: jest.fn(),
  };

  const mockRequirementsService = {
    updateRequirements: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeveloperController],
      providers: [
        { provide: GameService, useValue: mockGameService },
        { provide: ModerationService, useValue: mockModerationService },
        { provide: VersionService, useValue: mockVersionService },
        { provide: RequirementsService, useValue: mockRequirementsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeveloperController>(DeveloperController);
    gameService = module.get<GameService>(GameService);
    moderationService = module.get<ModerationService>(ModerationService);
    versionService = module.get<VersionService>(VersionService);
    requirementsService = module.get<RequirementsService>(RequirementsService);
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

  describe('getGameAnalytics', () => {
    it('should call getDeveloperGameAnalytics on the service and return the result', async () => {
      const gameId = 'test-game-id';
      const developerId = 'mock-dev-id';
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

  describe('submitForModeration', () => {
    it('should call submitForModeration on the moderation service', async () => {
      const gameId = 'game1';
      const developerId = 'mock-dev-id';

      await controller.submitForModeration(gameId);

      expect(moderationService.submitForModeration).toHaveBeenCalledWith(gameId, developerId);
    });
  });
});
