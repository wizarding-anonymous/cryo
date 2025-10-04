import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import {
  TestApiClient,
  extractGameResponse,
  extractPurchaseInfoResponse,
  createTestGame,
  expectValidGameResponse,
  expectValidPurchaseInfoResponse,
} from './utils/test-helpers';
import {
  TestGameResponse,
  TestPurchaseInfoResponse,
} from './types/test-interfaces';

describe('GameController (e2e)', () => {
  let app: INestApplication;
  let apiClient: TestApiClient;
  let createdGameId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const testGameData = createTestGame({
    title: 'E2E Test Game',
    price: 1999.99,
    developer: 'E2E Studios',
    genre: 'Testing',
  });

  it('POST /api/games - should create a new game', async () => {
    const response = await apiClient.createGame(testGameData);
    expect(response.status).toBe(201);

    const game: TestGameResponse = extractGameResponse(response);
    expectValidGameResponse(game);
    expect(game.title).toEqual(testGameData.title);

    createdGameId = game.id;
  });

  it('GET /api/games/:id - should get the created game', async () => {
    const response = await apiClient.getGame(createdGameId);
    expect(response.status).toBe(200);

    const game: TestGameResponse = extractGameResponse(response);
    expectValidGameResponse(game);
    expect(game.id).toEqual(createdGameId);
    expect(game.title).toEqual(testGameData.title);
  });

  it('GET /api/games/:id/purchase-info - should get purchase info for the game', async () => {
    const response = await apiClient.getPurchaseInfo(createdGameId);
    expect(response.status).toBe(200);

    const purchaseInfo: TestPurchaseInfoResponse =
      extractPurchaseInfoResponse(response);
    expectValidPurchaseInfoResponse(purchaseInfo);
    expect(purchaseInfo.id).toEqual(createdGameId);
    expect(purchaseInfo.title).toEqual(testGameData.title);
    expect(purchaseInfo.price).toEqual(testGameData.price);
    expect(purchaseInfo.available).toBe(true);
  });

  it('GET /api/games/:id - should return 404 for non-existent game', async () => {
    const response = await apiClient.getGame(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(response.status).toBe(404);
  });

  it('GET /api/games/:id/purchase-info - should return 404 for non-existent game', async () => {
    const response = await apiClient.getPurchaseInfo(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(response.status).toBe(404);
  });
});
