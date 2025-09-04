import { Test, TestingModule } from '@nestjs/testing';
import { ModerationController } from './moderation.controller';
import { ModerationService } from '../../../application/services/moderation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PaginationDto } from '../dtos/pagination.dto';
import { RejectGameDto } from '../dtos/reject-game.dto';
import { Game, GameStatus } from '../../../domain/entities/game.entity';

describe('ModerationController', () => {
  let controller: ModerationController;
  let service: ModerationService;

  const mockModerationService = {
    getModerationQueue: jest.fn(),
    approveGame: jest.fn(),
    rejectGame: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModerationController],
      providers: [
        {
          provide: ModerationService,
          useValue: mockModerationService,
        },
      ],
    })
    // Mock guards to bypass actual authentication logic in unit tests
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<ModerationController>(ModerationController);
    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getQueue', () => {
    it('should call getModerationQueue on the service with pagination dto', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const expectedResult = { data: [], total: 0 };
      mockModerationService.getModerationQueue.mockResolvedValue(expectedResult);

      const result = await controller.getQueue(paginationDto);

      expect(result).toEqual(expectedResult);
      expect(service.getModerationQueue).toHaveBeenCalledWith(paginationDto);
    });
  });

  describe('approveGame', () => {
    it('should call approveGame on the service with the correct game ID', async () => {
      const gameId = 'test-id';
      const game = { id: gameId, status: GameStatus.PUBLISHED } as Game;
      mockModerationService.approveGame.mockResolvedValue(game);

      const result = await controller.approveGame(gameId);

      expect(result).toEqual(game);
      expect(service.approveGame).toHaveBeenCalledWith(gameId);
    });
  });

  describe('rejectGame', () => {
    it('should call rejectGame on the service with the correct game ID and reason', async () => {
      const gameId = 'test-id';
      const rejectDto: RejectGameDto = { reason: 'Test Reason' };
      const game = { id: gameId, status: GameStatus.REJECTED } as Game;
      mockModerationService.rejectGame.mockResolvedValue(game);

      const result = await controller.rejectGame(gameId, rejectDto);

      expect(result).toEqual(game);
      expect(service.rejectGame).toHaveBeenCalledWith(gameId, rejectDto.reason);
    });
  });
});
