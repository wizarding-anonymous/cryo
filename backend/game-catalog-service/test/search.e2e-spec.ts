import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import {
  TestApiClient,
  extractGameListResponse,
  extractErrorResponse,
  createTestGameList,
  expectValidGameListResponse,
  expectValidErrorResponse,
} from './utils/test-helpers';
import {
  TestGameListResponse,
  TestErrorResponse,
} from './types/test-interfaces';

describe('SearchController (e2e)', () => {
  let app: INestApplication;
  let apiClient: TestApiClient;
  const testGameIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    apiClient = new TestApiClient(app);

    // Create test games for search functionality
    const testGames = createTestGameList(3);
    testGames[0].title = 'Cyberpunk 2077';
    testGames[0].description = 'Futuristic RPG game set in Night City';
    testGames[0].price = 2999.99;
    testGames[0].developer = 'CD Projekt RED';
    testGames[0].genre = 'RPG';

    testGames[1].title = 'The Witcher 3';
    testGames[1].description = 'Fantasy RPG adventure';
    testGames[1].price = 1499.99;
    testGames[1].developer = 'CD Projekt RED';
    testGames[1].genre = 'RPG';

    testGames[2].title = 'Counter-Strike 2';
    testGames[2].description = 'Competitive first-person shooter';
    testGames[2].price = 0;
    testGames[2].developer = 'Valve';
    testGames[2].genre = 'FPS';

    // Create test games
    for (const gameDto of testGames) {
      const response = await apiClient.createGame(gameDto);
      expect(response.status).toBe(201);
      const gameId = (response.body as { id: string }).id;
      testGameIds.push(gameId);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/games/search', () => {
    it('should search games by title', async () => {
      const response = await apiClient.searchGames({
        q: 'Cyberpunk',
        searchType: 'title',
      });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.total).toBeGreaterThan(0);
      expect(searchResult.games.length).toBeGreaterThan(0);
      expect(searchResult.games[0].title).toContain('Cyberpunk');
    });

    it('should search games by description', async () => {
      const response = await apiClient.searchGames({
        q: 'RPG',
        searchType: 'description',
      });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.total).toBeGreaterThan(0);
    });

    it('should search games across all fields', async () => {
      const response = await apiClient.searchGames({
        q: 'Valve',
        searchType: 'all',
      });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.total).toBeGreaterThan(0);
    });

    it('should return paginated results', async () => {
      const response = await apiClient.searchGames({ page: 1, limit: 2 });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.page).toBe(1);
      expect(searchResult.limit).toBe(2);
      expect(searchResult.games.length).toBeLessThanOrEqual(2);
    });

    it('should filter by price range', async () => {
      const response = await apiClient.searchGames({
        minPrice: 1000,
        maxPrice: 2000,
      });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      searchResult.games.forEach((game) => {
        expect(game.price).toBeGreaterThanOrEqual(1000);
        expect(game.price).toBeLessThanOrEqual(2000);
      });
    });

    it('should return empty results for non-existent search', async () => {
      const response = await apiClient.searchGames({
        q: 'NonExistentGameTitle12345',
      });
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.games).toHaveLength(0);
      expect(searchResult.total).toBe(0);
    });

    it('should return 400 for invalid price range', async () => {
      const response = await apiClient.searchGames({
        minPrice: 2000,
        maxPrice: 1000,
      });
      expect(response.status).toBe(400);

      const error: TestErrorResponse = extractErrorResponse(response);
      expectValidErrorResponse(error);
      expect(error.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for negative prices', async () => {
      const response = await apiClient.searchGames({ minPrice: -100 });
      expect(response.status).toBe(400);

      const error: TestErrorResponse = extractErrorResponse(response);
      expectValidErrorResponse(error);
      expect(error.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle search without query parameter', async () => {
      const response = await apiClient.searchGames({});
      expect(response.status).toBe(200);

      const searchResult: TestGameListResponse =
        extractGameListResponse(response);
      expectValidGameListResponse(searchResult);
      expect(searchResult.total).toBeGreaterThanOrEqual(0);
    });
  });
});
