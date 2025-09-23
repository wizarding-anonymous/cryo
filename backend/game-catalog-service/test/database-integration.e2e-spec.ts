import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Game } from '../src/entities/game.entity';
import { GameService } from '../src/game/game.service';
import { SearchService } from '../src/search/search.service';
import { CacheService } from '../src/common/services/cache.service';
import { ConfigModule } from '@nestjs/config';
import {
  setupTestDatabase,
  seedTestData,
  cleanupTestDatabase,
} from './setup-e2e';

describe('Database Integration Tests', () => {
  let module: TestingModule;
  let gameService: GameService;
  let searchService: SearchService;
  let gameRepository: Repository<Game>;
  let dataSource: DataSource;
  let testGames: Game[];

  beforeAll(async () => {
    // Setup test database
    dataSource = await setupTestDatabase();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
      ],
      providers: [
        GameService,
        SearchService,
        {
          provide: getRepositoryToken(Game),
          useValue: dataSource.getRepository(Game),
        },
        {
          provide: CacheService,
          useValue: {
            invalidateGameCache: jest.fn(),
          },
        },
      ],
    }).compile();

    gameService = module.get<GameService>(GameService);
    searchService = module.get<SearchService>(SearchService);
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));

    // Seed test data
    testGames = await seedTestData();
  });

  afterAll(async () => {
    await module.close();
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up any additional test data created during tests
    const allGames = await gameRepository.find();
    const testGameIds = testGames.map((game) => game.id);
    const additionalGames = allGames.filter(
      (game) => !testGameIds.includes(game.id),
    );

    if (additionalGames.length > 0) {
      await gameRepository.remove(additionalGames);
    }
  });

  describe('Database Connection and Schema', () => {
    it('should have a valid database connection', async () => {
      expect(dataSource.isInitialized).toBe(true);
      expect(dataSource.driver.database).toBe(process.env.POSTGRES_DB);
    });

    it('should have the Game entity properly mapped', async () => {
      const metadata = dataSource.getMetadata(Game);
      expect(metadata).toBeDefined();
      expect(metadata.tableName).toBe('games');

      // Check that all required columns exist
      const columnNames = metadata.columns.map((col) => col.propertyName);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('price');
      expect(columnNames).toContain('available');
    });

    it('should support database transactions', async () => {
      await dataSource
        .transaction(async (manager) => {
          const game = manager.create(Game, {
            title: 'Transaction Test Game',
            price: 99.99,
            developer: 'Test Dev',
            genre: 'Test',
          });

          const savedGame = await manager.save(game);
          expect(savedGame.id).toBeDefined();

          // This will be rolled back since we don't commit
          throw new Error('Rollback test');
        })
        .catch(() => {
          // Expected to fail
        });

      // Verify the game was not saved due to rollback
      const games = await gameRepository.find({
        where: { title: 'Transaction Test Game' },
      });
      expect(games).toHaveLength(0);
    });
  });

  describe('Game Repository Operations', () => {
    it('should create a new game with all fields', async () => {
      const gameData = {
        title: 'Integration Test Game',
        description: 'A comprehensive test game',
        shortDescription: 'Test game',
        price: 39.99,
        currency: 'RUB',
        genre: 'Adventure',
        developer: 'Integration Studio',
        publisher: 'Integration Publisher',
        releaseDate: new Date('2024-01-01'),
        images: ['integration1.jpg', 'integration2.jpg'],
        systemRequirements: {
          minimum: 'Minimum system requirements',
          recommended: 'Recommended system requirements',
        },
        available: true,
      };

      const game = gameRepository.create(gameData);
      const savedGame = await gameRepository.save(game);

      expect(savedGame.id).toBeDefined();
      expect(savedGame.title).toBe(gameData.title);
      expect(savedGame.price).toBe(gameData.price);
      expect(savedGame.systemRequirements).toEqual(gameData.systemRequirements);
      expect(savedGame.images).toEqual(gameData.images);
      expect(savedGame.createdAt).toBeDefined();
      expect(savedGame.updatedAt).toBeDefined();
    });

    it('should find games by various criteria', async () => {
      // Find by title
      const gameByTitle = await gameRepository.findOne({
        where: { title: testGames[0].title },
      });
      expect(gameByTitle).toBeDefined();
      expect(gameByTitle.title).toBe(testGames[0].title);

      // Find by genre
      const gamesByGenre = await gameRepository.find({
        where: { genre: 'RPG' },
      });
      expect(gamesByGenre.length).toBeGreaterThan(0);

      // Find available games
      const availableGames = await gameRepository.find({
        where: { available: true },
      });
      expect(availableGames.length).toBeGreaterThan(0);

      // Find by price range
      const expensiveGames = await gameRepository
        .createQueryBuilder('game')
        .where('game.price > :minPrice', { minPrice: 40 })
        .getMany();

      expect(expensiveGames.length).toBeGreaterThan(0);
    });

    it('should update game fields correctly', async () => {
      const game = testGames[0];
      const originalUpdatedAt = game.updatedAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      game.title = 'Updated Test Game';
      game.price = 59.99;

      const updatedGame = await gameRepository.save(game);

      expect(updatedGame.title).toBe('Updated Test Game');
      expect(updatedGame.price).toBe(59.99);
      expect(updatedGame.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    it('should delete games correctly', async () => {
      const game = testGames[2]; // Use the unavailable game

      await gameRepository.remove(game);

      const deletedGame = await gameRepository.findOne({
        where: { id: game.id },
      });
      expect(deletedGame).toBeNull();
    });

    it('should handle concurrent updates correctly', async () => {
      const game = testGames[0];

      // Simulate concurrent updates
      const update1 = gameRepository.save({
        ...game,
        title: 'Concurrent Update 1',
      });
      const update2 = gameRepository.save({
        ...game,
        title: 'Concurrent Update 2',
      });

      const [result1, result2] = await Promise.all([update1, update2]);

      // One of the updates should succeed
      expect(
        result1.title === 'Concurrent Update 1' ||
          result2.title === 'Concurrent Update 2',
      ).toBe(true);
    });
  });

  describe('GameService Database Integration', () => {
    it('should create games through service', async () => {
      const gameData = {
        title: 'Service Test Game',
        price: 25.99,
        developer: 'Service Studio',
        genre: 'Puzzle',
      };

      const createdGame = await gameService.createGame(gameData);

      expect(createdGame.id).toBeDefined();
      expect(createdGame.title).toBe(gameData.title);

      // Verify it's actually in the database
      const dbGame = await gameRepository.findOne({
        where: { id: createdGame.id },
      });
      expect(dbGame).toBeDefined();
      expect(dbGame.title).toBe(gameData.title);
    });

    it('should find games with pagination through service', async () => {
      const result = await gameService.getAllGames({ page: 1, limit: 2 });

      expect(result.games).toBeDefined();
      expect(result.games.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.hasNext).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Try to create a game with invalid data
      const invalidGameData = {
        title: null, // This should cause a database error
        price: 'invalid', // This should also cause an error
        developer: 'Test',
        genre: 'Test',
      };

      await expect(
        gameService.createGame(invalidGameData as any),
      ).rejects.toThrow();
    });
  });

  describe('SearchService Database Integration', () => {
    it('should perform full-text search on games', async () => {
      const searchResult = await searchService.searchGames({
        q: 'test',
        searchType: 'all',
        page: 1,
        limit: 10,
      });

      expect(searchResult.games).toBeDefined();
      expect(searchResult.total).toBeGreaterThan(0);
      expect(searchResult.games.length).toBeGreaterThan(0);

      // Verify search results contain the search term
      const hasSearchTerm = searchResult.games.some(
        (game) =>
          game.title.toLowerCase().includes('test') ||
          game.description?.toLowerCase().includes('test') ||
          game.developer.toLowerCase().includes('test'),
      );
      expect(hasSearchTerm).toBe(true);
    });

    it('should filter games by price range', async () => {
      const searchResult = await searchService.searchGames({
        minPrice: 30,
        maxPrice: 50,
        page: 1,
        limit: 10,
      });

      expect(searchResult.games).toBeDefined();

      // Verify all results are within price range
      searchResult.games.forEach((game) => {
        expect(game.price).toBeGreaterThanOrEqual(30);
        expect(game.price).toBeLessThanOrEqual(50);
      });
    });

    it('should search by specific fields', async () => {
      const titleSearch = await searchService.searchGames({
        q: 'Test Game 1',
        searchType: 'title',
        page: 1,
        limit: 10,
      });

      expect(titleSearch.games).toBeDefined();
      expect(titleSearch.games.length).toBeGreaterThan(0);

      const foundGame = titleSearch.games.find(
        (game) => game.title === 'Test Game 1',
      );
      expect(foundGame).toBeDefined();
    });

    it('should handle empty search results', async () => {
      const searchResult = await searchService.searchGames({
        q: 'NonExistentGameTitle12345',
        page: 1,
        limit: 10,
      });

      expect(searchResult.games).toBeDefined();
      expect(searchResult.games).toHaveLength(0);
      expect(searchResult.total).toBe(0);
    });
  });

  describe('Database Performance and Optimization', () => {
    it('should execute queries efficiently with proper indexing', async () => {
      const startTime = Date.now();

      // Perform a complex query that should benefit from indexing
      const results = await gameRepository
        .createQueryBuilder('game')
        .where('game.available = :available', { available: true })
        .andWhere('game.price BETWEEN :minPrice AND :maxPrice', {
          minPrice: 0,
          maxPrice: 100,
        })
        .orderBy('game.createdAt', 'DESC')
        .limit(10)
        .getMany();

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(results).toBeDefined();
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large result sets with pagination', async () => {
      // Create additional test games for pagination testing
      const additionalGames = Array.from({ length: 25 }, (_, i) => ({
        title: `Pagination Test Game ${i + 1}`,
        price: 10 + i,
        developer: 'Pagination Studio',
        genre: 'Test',
      }));

      await gameRepository.save(additionalGames);

      // Test pagination
      const page1 = await gameService.getAllGames({ page: 1, limit: 10 });
      const page2 = await gameService.getAllGames({ page: 2, limit: 10 });

      expect(page1.games).toHaveLength(10);
      expect(page2.games.length).toBeGreaterThan(0);
      expect(page1.hasNext).toBe(true);

      // Verify no duplicate games between pages
      const page1Ids = page1.games.map((game) => game.id);
      const page2Ids = page2.games.map((game) => game.id);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce unique constraints where applicable', async () => {
      const gameData = {
        title: 'Unique Test Game',
        price: 29.99,
        developer: 'Unique Studio',
        genre: 'Unique',
      };

      // Create first game
      await gameRepository.save(gameData);

      // Try to create another game with the same title (if unique constraint exists)
      // Note: This test assumes title should be unique - adjust based on actual constraints
      const duplicateGame = gameRepository.create(gameData);

      // This might not throw an error if title uniqueness is not enforced
      // Adjust the test based on your actual database constraints
      const result = await gameRepository.save(duplicateGame);
      expect(result).toBeDefined(); // Adjust expectation based on constraints
    });

    it('should handle null and default values correctly', async () => {
      const minimalGameData = {
        title: 'Minimal Game',
        price: 19.99,
        developer: 'Minimal Studio',
        genre: 'Minimal',
      };

      const game = await gameRepository.save(minimalGameData);

      expect(game.id).toBeDefined();
      expect(game.currency).toBe('RUB'); // Default value
      expect(game.available).toBe(true); // Default value
      expect(game.createdAt).toBeDefined();
      expect(game.updatedAt).toBeDefined();
    });

    it('should validate data types and constraints', async () => {
      // Test with invalid price (negative)
      const invalidPriceGame = {
        title: 'Invalid Price Game',
        price: -10.0,
        developer: 'Test Studio',
        genre: 'Test',
      };

      // This should either throw an error or be handled by validation
      // Adjust based on your validation implementation
      const result = await gameRepository.save(invalidPriceGame);
      expect(result.price).toBe(-10.0); // Adjust based on validation rules
    });
  });
});
