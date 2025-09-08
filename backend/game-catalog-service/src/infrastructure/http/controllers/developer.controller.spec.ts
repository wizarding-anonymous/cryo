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

  describe('createVersion', () => {
    it('should call createVersion on the service with correct parameters', async () => {
      const gameId = 'game1';
      const developerId = 'mock-dev-id';
      const dto: CreateVersionDto = { version: '1.2.0', changelog: 'New stuff' };

      await controller.createVersion(gameId, dto);

      expect(versionService.createVersion).toHaveBeenCalledWith(gameId, developerId, dto);
    });
  });

  describe('getVersionHistory', () => {
    it('should call getVersionHistory on the service with correct game ID', async () => {
      const gameId = 'game1';

      await controller.getVersionHistory(gameId);

      expect(versionService.getVersionHistory).toHaveBeenCalledWith(gameId);
    });
  });

  describe('updateRequirements', () => {
    it('should call updateRequirements on the service with correct parameters', async () => {
      const gameId = 'game1';
      const developerId = 'mock-dev-id';
      const dto = new SystemRequirements();

      await controller.updateRequirements(gameId, dto);

      expect(requirementsService.updateRequirements).toHaveBeenCalledWith(gameId, developerId, dto);
    });
  });
});
