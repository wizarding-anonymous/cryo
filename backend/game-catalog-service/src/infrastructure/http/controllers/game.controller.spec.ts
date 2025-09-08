import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from '../../../application/services/game.service';
import { RequirementsService } from '../../../application/services/requirements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('GameController', () => {
  let controller: GameController;
  let gameService: GameService;
  let requirementsService: RequirementsService;

  const mockGameService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequirementsService = {
    getRequirements: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        { provide: GameService, useValue: mockGameService },
        { provide: RequirementsService, useValue: mockRequirementsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GameController>(GameController);
    gameService = module.get<GameService>(GameService);
    requirementsService = module.get<RequirementsService>(RequirementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRequirements', () => {
    it('should call getRequirements on the service with the correct game ID', async () => {
      const gameId = 'test-id';
      mockRequirementsService.getRequirements.mockResolvedValue({} as any);

      await controller.getRequirements(gameId);

      expect(requirementsService.getRequirements).toHaveBeenCalledWith(gameId);
    });
  });
});
