import { Test, TestingModule } from '@nestjs/testing';
import { FranchiseService } from '../franchise.service';
import { Franchise } from '../../../domain/entities/franchise.entity';
import { Game } from '../../../domain/entities/game.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('FranchiseService', () => {
  let service: FranchiseService;
  let franchiseRepository: Repository<Franchise>;
  let gameRepository: Repository<Game>;

  const mockFranchiseRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockGameRepository = {
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseService,
        {
          provide: getRepositoryToken(Franchise),
          useValue: mockFranchiseRepository,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
      ],
    }).compile();

    service = module.get<FranchiseService>(FranchiseService);
    franchiseRepository = module.get<Repository<Franchise>>(getRepositoryToken(Franchise));
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFranchise', () => {
    it('should create a franchise successfully', async () => {
      const franchiseData = { name: 'Super Game Series' };
      const gameIds = ['game-1', 'game-2'];
      const games = [{ id: 'game-1' }, { id: 'game-2' }] as Game[];
      const expectedFranchise = { id: 'franchise-1', ...franchiseData, games };

      mockGameRepository.findBy.mockResolvedValue(games);
      mockFranchiseRepository.create.mockReturnValue(expectedFranchise);
      mockFranchiseRepository.save.mockResolvedValue(expectedFranchise);

      const result = await service.createFranchise(franchiseData, gameIds);

      expect(result).toEqual(expectedFranchise);
      expect(mockGameRepository.findBy).toHaveBeenCalledWith({ id: expect.anything() });
      expect(mockFranchiseRepository.create).toHaveBeenCalledWith({ ...franchiseData, games });
      expect(mockFranchiseRepository.save).toHaveBeenCalledWith(expectedFranchise);
    });
  });
});
