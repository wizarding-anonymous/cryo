import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FranchiseService } from '../franchise.service';
import { Franchise } from '../../../domain/entities/franchise.entity';
import { FranchiseGame } from '../../../domain/entities/franchise-game.entity';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { FranchiseRepository } from '../../../infrastructure/persistence/franchise.repository';

const mockFranchiseRepository = {
  findOne: jest.fn(),
};

const mockFranchiseGameRepository = {};
const mockGameRepository = {};


describe('FranchiseService', () => {
  let service: FranchiseService;
  let repository: typeof mockFranchiseRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FranchiseService,
        { provide: FranchiseRepository, useValue: mockFranchiseRepository },
        { provide: getRepositoryToken(FranchiseGame), useValue: mockFranchiseGameRepository },
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<FranchiseService>(FranchiseService);
    repository = module.get(FranchiseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a franchise with games sorted by orderInSeries', async () => {
      // The sorting is done by TypeORM based on the 'order' option in the query.
      // We just need to ensure the service calls the repository with the correct options.
      const franchiseId = 'some-uuid';

      await service.findOne(franchiseId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: franchiseId },
        relations: ['gamesInFranchise', 'gamesInFranchise.game'],
        order: {
            gamesInFranchise: {
                orderInSeries: 'ASC'
            }
        }
      });
    });
  });
});
