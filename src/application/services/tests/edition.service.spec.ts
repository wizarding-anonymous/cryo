import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EditionService } from '../edition.service';
import { GameEdition } from '../../../domain/entities/game-edition.entity';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';

const mockEditionRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockGameRepository = {};

describe('EditionService', () => {
  let service: EditionService;
  let repository: typeof mockEditionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditionService,
        { provide: getRepositoryToken(GameEdition), useValue: mockEditionRepository },
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<EditionService>(EditionService);
    repository = module.get(getRepositoryToken(GameEdition));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('compareEditions', () => {
    it('should call the repository to find editions for a game', async () => {
      const gameId = 'game-uuid';
      await service.compareEditions(gameId);
      expect(repository.find).toHaveBeenCalledWith({
        where: { gameId },
        order: { price: 'ASC' },
      });
    });
  });

  describe('calculateUpgradePrice', () => {
    it('should calculate the correct upgrade price', async () => {
      const standardEdition = { id: 'std', gameId: 'g1', price: 20 } as GameEdition;
      const deluxeEdition = { id: 'dlx', gameId: 'g1', price: 50 } as GameEdition;

      repository.findOne
        .mockResolvedValueOnce(standardEdition)
        .mockResolvedValueOnce(deluxeEdition);

      const result = await service.calculateUpgradePrice('std', 'dlx');
      expect(result.upgradePrice).toBe(30);
    });

    it('should return 0 if the target edition is cheaper', async () => {
        const standardEdition = { id: 'std', gameId: 'g1', price: 20 } as GameEdition;
        const deluxeEdition = { id: 'dlx', gameId: 'g1', price: 50 } as GameEdition;

        repository.findOne
          .mockResolvedValueOnce(deluxeEdition)
          .mockResolvedValueOnce(standardEdition);

        const result = await service.calculateUpgradePrice('dlx', 'std');
        expect(result.upgradePrice).toBe(0);
    });

    it('should throw an error if editions are for different games', async () => {
        const edition1 = { id: 'e1', gameId: 'g1', price: 20 } as GameEdition;
        const edition2 = { id: 'e2', gameId: 'g2', price: 50 } as GameEdition;

        repository.findOne
          .mockResolvedValueOnce(edition1)
          .mockResolvedValueOnce(edition2);

        await expect(service.calculateUpgradePrice('e1', 'e2')).rejects.toThrow('Editions must be for the same game.');
    });
  });
});
