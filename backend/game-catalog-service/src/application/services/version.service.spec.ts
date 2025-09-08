import { Test, TestingModule } from '@nestjs/testing';
import { VersionService } from './version.service';
import { GameVersionRepository } from '../../infrastructure/persistence/game-version.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { EventPublisherService } from './event-publisher.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Game } from '../../domain/entities/game.entity';
import { CreateVersionDto } from '../../infrastructure/http/dtos/create-version.dto';
import { DataSource } from 'typeorm';

describe('VersionService', () => {
  let service: VersionService;
  let versionRepository: GameVersionRepository;
  let gameRepository: GameRepository;
  let eventPublisher: EventPublisherService;

  const mockVersionRepo = {
    create: jest.fn(),
    findByGameId: jest.fn(),
    unsetCurrent: jest.fn(),
  };
  const mockGameRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  };
  const mockEventPublisher = {
    publish: jest.fn(),
  };
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionService,
        { provide: GameVersionRepository, useValue: mockVersionRepo },
        { provide: GameRepository, useValue: mockGameRepo },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<VersionService>(VersionService);
    versionRepository = module.get<GameVersionRepository>(GameVersionRepository);
    gameRepository = module.get<GameRepository>(GameRepository);
    eventPublisher = module.get<EventPublisherService>(EventPublisherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVersion', () => {
    const gameId = 'game-id';
    const developerId = 'dev-id';
    const dto: CreateVersionDto = { version: '1.1.0', changelog: 'test' };
    const game = { id: gameId, developerId } as Game;

    it('should create a new version and update the game', async () => {
      mockGameRepo.findById.mockResolvedValue(game);
      mockVersionRepo.create.mockResolvedValue({ ...dto, gameId, isCurrent: true });

      await service.createVersion(gameId, developerId, dto);

      expect(gameRepository.findById).toHaveBeenCalledWith(gameId);
      expect(versionRepository.unsetCurrent).toHaveBeenCalledWith(gameId);
      expect(versionRepository.create).toHaveBeenCalledWith({ gameId, ...dto, isCurrent: true });
      expect(gameRepository.save).toHaveBeenCalledWith(expect.objectContaining({ version: '1.1.0' }));
      expect(eventPublisher.publish).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException if game not found', async () => {
      mockGameRepo.findById.mockResolvedValue(null);
      await expect(service.createVersion(gameId, developerId, dto)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if developer does not own the game', async () => {
      mockGameRepo.findById.mockResolvedValue({ ...game, developerId: 'other-dev' });
      await expect(service.createVersion(gameId, developerId, dto)).rejects.toThrow(ForbiddenException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getVersionHistory', () => {
    it('should return the version history for a game', async () => {
      const gameId = 'game-id';
      const history = [{ version: '1.0.0' }, { version: '1.1.0' }];
      mockVersionRepo.findByGameId.mockResolvedValue(history as any);

      const result = await service.getVersionHistory(gameId);

      expect(result).toEqual(history);
      expect(versionRepository.findByGameId).toHaveBeenCalledWith(gameId);
    });
  });
});
