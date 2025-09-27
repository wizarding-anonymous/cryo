import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from '../entities/game.entity';
import { PurchaseInfoDto } from '../dto/purchase-info.dto';
import { CacheService } from '../common/services/cache.service';

// Mock TypeORM repository
const mockGameRepository = () => ({
  findOneBy: jest.fn(),
});

// Mock CacheService
const mockCacheService = () => ({
  invalidateGameCache: jest.fn(),
});

describe('Payment Service Integration Tests', () => {
  let service: GameService;
  let repository: Repository<Game>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useFactory: mockGameRepository,
        },
        {
          provide: CacheService,
          useFactory: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    repository = module.get<Repository<Game>>(getRepositoryToken(Game));
  });

  describe('getGamePurchaseInfo - Payment Service Integration', () => {
    it('should return valid purchase info with correct price and currency validation', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'test-game-id';
      mockGame.title = 'Test Game for Payment';
      mockGame.price = 1999.99;
      mockGame.currency = 'RUB';
      mockGame.available = true;

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act
      const result = await service.getGamePurchaseInfo('test-game-id');

      // Assert
      expect(result).toBeInstanceOf(PurchaseInfoDto);
      expect(result.id).toBe('test-game-id');
      expect(result.title).toBe('Test Game for Payment');
      expect(result.price).toBe(1999.99);
      expect(result.currency).toBe('RUB');
      expect(result.available).toBe(true);
      expect(typeof result.price).toBe('number');
      expect(typeof result.currency).toBe('string');
      expect(result.currency).toHaveLength(3); // Currency code validation
    });

    it('should handle decimal price precision correctly for payment operations', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'test-game-id';
      mockGame.title = 'Precision Test Game';
      mockGame.price = 29.99; // Common price with decimal precision
      mockGame.currency = 'USD';
      mockGame.available = true;

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act
      const result = await service.getGamePurchaseInfo('test-game-id');

      // Assert
      expect(result.price).toBe(29.99);
      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.price.toString()).toMatch(/^\d+\.\d{2}$/); // Ensure proper decimal format
    });

    it('should validate currency code format for payment processing', async () => {
      // Test different valid currency codes
      const currencies = ['RUB', 'USD', 'EUR', 'GBP'];

      for (const currency of currencies) {
        const mockGame = new Game();
        mockGame.id = `test-game-${currency}`;
        mockGame.title = `Test Game ${currency}`;
        mockGame.price = 100.0;
        mockGame.currency = currency;
        mockGame.available = true;

        (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

        const result = await service.getGamePurchaseInfo(
          `test-game-${currency}`,
        );

        expect(result.currency).toBe(currency);
        expect(result.currency).toHaveLength(3);
        expect(result.currency).toMatch(/^[A-Z]{3}$/); // ISO 4217 format
      }
    });

    it('should throw NotFoundException for unavailable games (Payment Service requirement)', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'unavailable-game';
      mockGame.title = 'Unavailable Game';
      mockGame.price = 59.99;
      mockGame.currency = 'RUB';
      mockGame.available = false; // Game is not available for purchase

      (repository.findOneBy as jest.Mock)
        .mockResolvedValueOnce(null) // First call for available game
        .mockResolvedValueOnce(mockGame); // Second call for any game

      // Act & Assert
      await expect(
        service.getGamePurchaseInfo('unavailable-game'),
      ).rejects.toThrow(
        new NotFoundException(
          'Game with ID "unavailable-game" is currently unavailable',
        ),
      );
    });

    it('should throw NotFoundException for non-existent games (Payment Service requirement)', async () => {
      // Arrange
      (repository.findOneBy as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getGamePurchaseInfo('non-existent-game'),
      ).rejects.toThrow(
        new NotFoundException('Game with ID "non-existent-game" not found'),
      );
    });

    it('should handle edge case prices correctly for payment processing', async () => {
      const testCases = [
        { price: 0, description: 'free game' },
        { price: 0.01, description: 'minimum price' },
        { price: 999999.99, description: 'maximum price' },
        { price: 19.95, description: 'common promotional price' },
      ];

      for (const testCase of testCases) {
        const mockGame = new Game();
        mockGame.id = `test-${testCase.price}`;
        mockGame.title = `Test ${testCase.description}`;
        mockGame.price = testCase.price;
        mockGame.currency = 'RUB';
        mockGame.available = true;

        (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

        const result = await service.getGamePurchaseInfo(
          `test-${testCase.price}`,
        );

        expect(result.price).toBe(testCase.price);
        expect(typeof result.price).toBe('number');
        expect(Number.isFinite(result.price)).toBe(true);
      }
    });

    it('should ensure purchase info contains only necessary fields for Payment Service', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'test-game-id';
      mockGame.title = 'Test Game';
      mockGame.description = 'This should not be in purchase info';
      mockGame.shortDescription = 'This should not be in purchase info';
      mockGame.price = 49.99;
      mockGame.currency = 'RUB';
      mockGame.genre = 'This should not be in purchase info';
      mockGame.developer = 'This should not be in purchase info';
      mockGame.available = true;
      mockGame.createdAt = new Date();
      mockGame.updatedAt = new Date();

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act
      const result = await service.getGamePurchaseInfo('test-game-id');

      // Assert - Only essential fields for payment processing
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('available');

      // Should NOT contain unnecessary fields
      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('shortDescription');
      expect(result).not.toHaveProperty('genre');
      expect(result).not.toHaveProperty('developer');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should handle concurrent purchase info requests correctly', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'concurrent-test-game';
      mockGame.title = 'Concurrent Test Game';
      mockGame.price = 39.99;
      mockGame.currency = 'RUB';
      mockGame.available = true;

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act - Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        service.getGamePurchaseInfo('concurrent-test-game'),
      );

      const results = await Promise.all(promises);

      // Assert - All results should be identical
      results.forEach((result) => {
        expect(result.id).toBe('concurrent-test-game');
        expect(result.price).toBe(39.99);
        expect(result.currency).toBe('RUB');
        expect(result.available).toBe(true);
      });

      // Repository should be called for each request (no caching at service level)
      expect(repository.findOneBy).toHaveBeenCalledTimes(5);
    });

    it('should validate that price is properly cast to number for Payment Service', async () => {
      // Arrange - Simulate database returning string price (edge case)
      const mockGame = new Game();
      mockGame.id = 'price-cast-test';
      mockGame.title = 'Price Cast Test';
      mockGame.price = '59.99' as any; // Simulate string from database
      mockGame.currency = 'RUB';
      mockGame.available = true;

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act
      const result = await service.getGamePurchaseInfo('price-cast-test');

      // Assert - PurchaseInfoDto constructor should cast to number
      expect(typeof result.price).toBe('number');
      expect(result.price).toBe(59.99);
    });

    it('should maintain data consistency for Payment Service integration', async () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'consistency-test';
      mockGame.title = 'Data Consistency Test';
      mockGame.price = 79.99;
      mockGame.currency = 'RUB';
      mockGame.available = true;

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockGame);

      // Act - Multiple calls should return consistent data
      const result1 = await service.getGamePurchaseInfo('consistency-test');
      const result2 = await service.getGamePurchaseInfo('consistency-test');

      // Assert
      expect(result1).toEqual(result2);
      expect(result1.id).toBe(result2.id);
      expect(result1.price).toBe(result2.price);
      expect(result1.currency).toBe(result2.currency);
      expect(result1.available).toBe(result2.available);
    });
  });

  describe('Purchase Info DTO Validation', () => {
    it('should create PurchaseInfoDto with proper type casting', () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'dto-test';
      mockGame.title = 'DTO Test Game';
      mockGame.price = 29.99;
      mockGame.currency = 'USD';
      mockGame.available = true;

      // Act
      const dto = new PurchaseInfoDto(mockGame);

      // Assert
      expect(dto.id).toBe('dto-test');
      expect(dto.title).toBe('DTO Test Game');
      expect(dto.price).toBe(29.99);
      expect(dto.currency).toBe('USD');
      expect(dto.available).toBe(true);
      expect(typeof dto.price).toBe('number');
    });

    it('should handle price casting from decimal/string to number', () => {
      // Arrange
      const mockGame = new Game();
      mockGame.id = 'casting-test';
      mockGame.title = 'Casting Test';
      mockGame.price = '199.99' as any; // Simulate string price
      mockGame.currency = 'RUB';
      mockGame.available = true;

      // Act
      const dto = new PurchaseInfoDto(mockGame);

      // Assert
      expect(typeof dto.price).toBe('number');
      expect(dto.price).toBe(199.99);
      expect(Number.isNaN(dto.price)).toBe(false);
    });
  });
});
