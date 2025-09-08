import { Test, TestingModule } from '@nestjs/testing';
import { RequirementsService } from './requirements.service';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Game } from '../../domain/entities/game.entity';
import { SystemRequirements } from '../../domain/entities/system-requirements.entity';

describe('RequirementsService', () => {
  let service: RequirementsService;
  let gameRepository: GameRepository;

  const mockGameRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequirementsService,
        { provide: GameRepository, useValue: mockGameRepo },
      ],
    }).compile();

    service = module.get<RequirementsService>(RequirementsService);
    gameRepository = module.get<GameRepository>(GameRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRequirements', () => {
    it('should return system requirements for a game', async () => {
      const gameId = 'game-id';
      const requirements = new SystemRequirements();
      mockGameRepo.findById.mockResolvedValue({ id: gameId, systemRequirements: requirements });

      const result = await service.getRequirements(gameId);

      expect(result).toEqual(requirements);
      expect(gameRepository.findById).toHaveBeenCalledWith(gameId);
    });

    it('should throw NotFoundException if game not found', async () => {
      mockGameRepo.findById.mockResolvedValue(null);
      await expect(service.getRequirements('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRequirements', () => {
    const gameId = 'game-id';
    const developerId = 'dev-id';
    const requirements = new SystemRequirements();
    const game = { id: gameId, developerId, systemRequirements: null } as Game;

    it('should update requirements and save the game', async () => {
      mockGameRepo.findById.mockResolvedValue(game);
      mockGameRepo.save.mockResolvedValue({ ...game, systemRequirements: requirements });

      await service.updateRequirements(gameId, developerId, requirements);

      expect(gameRepository.save).toHaveBeenCalledWith(expect.objectContaining({ systemRequirements: requirements }));
    });

    it('should throw ForbiddenException if developer is not the owner', async () => {
        mockGameRepo.findById.mockResolvedValue(game);
        await expect(service.updateRequirements(gameId, 'other-dev', requirements)).rejects.toThrow(ForbiddenException);
      });
  });
});
