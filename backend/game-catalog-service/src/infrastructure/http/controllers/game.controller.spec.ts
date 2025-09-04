import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from '../../../application/services/game.service';
import { RequirementsService } from '../../../application/services/requirements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('GameController', () => {
  let controller: GameController;
  let gameService: GameService;

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('should call findOne on the service with id and language header', async () => {
      const gameId = 'test-id';
      const langHeader = 'en-US,en;q=0.9';
      mockGameService.findOne.mockResolvedValue({ id: gameId });

      await controller.findOne(gameId, langHeader);

      expect(gameService.findOne).toHaveBeenCalledWith(gameId, langHeader);
    });
  });

  describe('findAll', () => {
    it('should call findAll on the service with pagination and language header', async () => {
      const paginationDto = { page: 1, limit: 10 };
      const langHeader = 'ru-RU';
      mockGameService.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll(paginationDto, langHeader);

      expect(gameService.findAll).toHaveBeenCalledWith(paginationDto, langHeader);
    });
  });
});
