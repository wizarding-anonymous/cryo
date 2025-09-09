import { Test, TestingModule } from '@nestjs/testing';
import { BundleService } from '../bundle.service';
import { BundleRepository } from '../../../infrastructure/persistence/bundle.repository';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { LibraryServiceIntegration } from '../../../infrastructure/integrations/library.service';
import { Game } from '../../../domain/entities/game.entity';
import { Bundle } from '../../../domain/entities/bundle.entity';

const mockBundleRepository = {
  findById: jest.fn(),
};

const mockGameRepository = {};

const mockLibraryService = {
  filterOwnedGames: jest.fn(),
};

describe('BundleService', () => {
  let service: BundleService;
  let libraryService: LibraryServiceIntegration;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundleService,
        { provide: BundleRepository, useValue: mockBundleRepository },
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: LibraryServiceIntegration, useValue: mockLibraryService },
      ],
    }).compile();

    service = module.get<BundleService>(BundleService);
    libraryService = module.get<LibraryServiceIntegration>(LibraryServiceIntegration);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBundleForUser', () => {
    it('should calculate dynamic price and savings correctly when user owns some games', async () => {
      // Arrange
      const game1 = { id: 'g1', price: 20 } as Game;
      const game2 = { id: 'g2', price: 30 } as Game;
      const game3 = { id: 'g3', price: 50 } as Game;

      const bundle = {
        id: 'b1',
        name: 'Test Bundle',
        price: 80, // Discounted price for all 3
        games: [game1, game2, game3],
      } as Bundle;

      mockBundleRepository.findById.mockResolvedValue(bundle);
      // User owns game1
      mockLibraryService.filterOwnedGames.mockResolvedValue(['g1']);

      // Act
      const result = await service.getBundleForUser('b1', 'user-1');

      // Assert
      expect(libraryService.filterOwnedGames).toHaveBeenCalledWith('user-1', ['g1', 'g2', 'g3']);
      // Total original price is 20 + 30 + 50 = 100. Bundle price is 80. Savings = 20.
      expect(result.savings).toBe(20);
      // User owns game1 (price 20), so dynamic price is for game2 and game3.
      expect(result.price).toBe(80); // 30 + 50
      expect(result.games.length).toBe(2);
      expect(result.games.map(g => g.id)).toEqual(['g2', 'g3']);
    });

    it('should show all games if user owns none', async () => {
        const game1 = { id: 'g1', price: 20 } as Game;
        const game2 = { id: 'g2', price: 30 } as Game;

        const bundle = {
          id: 'b1',
          name: 'Test Bundle',
          price: 40, // Discounted price
          games: [game1, game2],
        } as Bundle;

        mockBundleRepository.findById.mockResolvedValue(bundle);
        // User owns no games from the bundle
        mockLibraryService.filterOwnedGames.mockResolvedValue([]);

        // Act
        const result = await service.getBundleForUser('b1', 'user-2');

        // Assert
        // Total original price is 20 + 30 = 50. Bundle price is 40. Savings = 10.
        expect(result.savings).toBe(10);
        // User owns nothing, dynamic price is the sum of all game prices.
        expect(result.price).toBe(50);
        expect(result.games.length).toBe(2);
      });
  });
});
