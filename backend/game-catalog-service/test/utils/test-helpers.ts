import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TestGameResponse,
  TestGameListResponse,
  TestPurchaseInfoResponse,
  TestErrorResponse,
  TestHealthResponse,
  TestCreateGameDto,
  isGameResponse,
  isGameListResponse,
  isErrorResponse,
  isPurchaseInfoResponse,
  isHealthResponse,
} from '../types/test-interfaces';

// Typed SuperTest wrapper functions
export class TestApiClient {
  constructor(private readonly app: INestApplication) {}

  async getGames(
    params: Record<string, string | number> = {},
  ): Promise<request.Response> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      query.append(key, String(value));
    });

    return request(this.app.getHttpServer())
      .get(`/api/games?${query.toString()}`)
      .expect('Content-Type', /json/);
  }

  async getGame(id: string): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .get(`/api/games/${id}`)
      .expect('Content-Type', /json/);
  }

  async getPurchaseInfo(id: string): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .get(`/api/games/${id}/purchase-info`)
      .expect('Content-Type', /json/);
  }

  async searchGames(
    params: Record<string, string | number> = {},
  ): Promise<request.Response> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      query.append(key, String(value));
    });

    return request(this.app.getHttpServer())
      .get(`/api/games/search?${query.toString()}`)
      .expect('Content-Type', /json/);
  }

  async getHealth(): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .get('/api/v1/health')
      .expect('Content-Type', /json/);
  }

  async getHealthReady(): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect('Content-Type', /json/);
  }

  async getHealthLive(): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .get('/api/v1/health/live')
      .expect('Content-Type', /json/);
  }

  async createGame(gameData: TestCreateGameDto): Promise<request.Response> {
    return request(this.app.getHttpServer())
      .post('/api/games')
      .send(gameData)
      .expect('Content-Type', /json/);
  }
}

// Type-safe response extractors
export function extractGameResponse(
  response: request.Response,
): TestGameResponse {
  const body = response.body as unknown;
  if (!isGameResponse(body)) {
    throw new Error(`Invalid game response: ${JSON.stringify(body)}`);
  }
  return body;
}

export function extractGameListResponse(
  response: request.Response,
): TestGameListResponse {
  const body = response.body as unknown;
  if (!isGameListResponse(body)) {
    throw new Error(`Invalid game list response: ${JSON.stringify(body)}`);
  }
  return body;
}

export function extractPurchaseInfoResponse(
  response: request.Response,
): TestPurchaseInfoResponse {
  const body = response.body as unknown;
  if (!isPurchaseInfoResponse(body)) {
    throw new Error(`Invalid purchase info response: ${JSON.stringify(body)}`);
  }
  return body;
}

export function extractErrorResponse(
  response: request.Response,
): TestErrorResponse {
  const body = response.body as unknown;
  if (!isErrorResponse(body)) {
    throw new Error(`Invalid error response: ${JSON.stringify(body)}`);
  }
  return body;
}

export function extractHealthResponse(
  response: request.Response,
): TestHealthResponse {
  const body = response.body as unknown;
  if (!isHealthResponse(body)) {
    throw new Error(`Invalid health response: ${JSON.stringify(body)}`);
  }
  return body;
}

// Test data factories
export function createTestGame(
  overrides: Partial<TestCreateGameDto> = {},
): TestCreateGameDto {
  return {
    title: 'Test Game',
    description: 'A test game for integration testing',
    shortDescription: 'Test game',
    price: 1999.99,
    currency: 'RUB',
    genre: 'Action',
    developer: 'Test Developer',
    publisher: 'Test Publisher',
    releaseDate: '2023-01-01',
    images: ['https://example.com/image1.jpg'],
    systemRequirements: {
      minimum: 'OS: Windows 10, CPU: Intel i3, RAM: 4GB',
      recommended: 'OS: Windows 11, CPU: Intel i5, RAM: 8GB',
    },
    available: true,
    ...overrides,
  };
}

export function createTestGameList(count: number = 3): TestCreateGameDto[] {
  return Array.from({ length: count }, (_, index) =>
    createTestGame({
      title: `Test Game ${index + 1}`,
      price: 1000 + index * 500,
      genre: index % 2 === 0 ? 'Action' : 'RPG',
    }),
  );
}

// Assertion helpers
export function expectValidGameResponse(game: TestGameResponse): void {
  expect(game.id).toBeDefined();
  expect(typeof game.id).toBe('string');
  expect(game.title).toBeDefined();
  expect(typeof game.title).toBe('string');
  expect(game.price).toBeDefined();
  expect(typeof game.price).toBe('number');
  expect(game.currency).toBeDefined();
  expect(typeof game.currency).toBe('string');
  expect(typeof game.available).toBe('boolean');
  expect(game.systemRequirements).toBeDefined();
  expect(game.systemRequirements.minimum).toBeDefined();
  expect(game.systemRequirements.recommended).toBeDefined();
}

export function expectValidGameListResponse(
  response: TestGameListResponse,
): void {
  expect(Array.isArray(response.games)).toBe(true);
  expect(typeof response.total).toBe('number');
  expect(typeof response.page).toBe('number');
  expect(typeof response.limit).toBe('number');
  expect(typeof response.totalPages).toBe('number');
  expect(typeof response.hasNext).toBe('boolean');
  expect(typeof response.hasPrevious).toBe('boolean');

  response.games.forEach((game) => expectValidGameResponse(game));
}

export function expectValidErrorResponse(error: TestErrorResponse): void {
  expect(error.error).toBeDefined();
  expect(error.error.code).toBeDefined();
  expect(typeof error.error.code).toBe('string');
  expect(error.error.message).toBeDefined();
  expect(typeof error.error.message).toBe('string');
  expect(error.error.statusCode).toBeDefined();
  expect(typeof error.error.statusCode).toBe('number');
  expect(error.error.timestamp).toBeDefined();
  expect(error.error.path).toBeDefined();
}

export function expectValidPurchaseInfoResponse(
  purchaseInfo: TestPurchaseInfoResponse,
): void {
  expect(purchaseInfo.id).toBeDefined();
  expect(typeof purchaseInfo.id).toBe('string');
  expect(purchaseInfo.title).toBeDefined();
  expect(typeof purchaseInfo.title).toBe('string');
  expect(purchaseInfo.price).toBeDefined();
  expect(typeof purchaseInfo.price).toBe('number');
  expect(purchaseInfo.currency).toBeDefined();
  expect(typeof purchaseInfo.currency).toBe('string');
  expect(typeof purchaseInfo.available).toBe('boolean');
}

export function expectValidHealthResponse(health: TestHealthResponse): void {
  expect(health.status).toBeDefined();
  expect(typeof health.status).toBe('string');
  expect(health.details).toBeDefined();
  expect(typeof health.details).toBe('object');
}
