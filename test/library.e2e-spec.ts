import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LibraryService } from '../src/library/library.service';
import { SearchService } from '../src/library/search.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AddGameToLibraryDto } from 'src/library/dto/request.dto';

describe('LibraryController (e2e)', () => {
  let app: INestApplication;

  const mockLibraryService = {
    getUserLibrary: jest.fn(() => ({ games: [], pagination: { total: 0 } })),
    checkGameOwnership: jest.fn(() => ({ owns: true })),
    addGameToLibrary: jest.fn((dto) => ({ id: 'new-game', ...dto })),
    removeGameFromLibrary: jest.fn(() => Promise.resolve()),
  };

  const mockSearchService = {
    searchUserLibrary: jest.fn(() => []),
  };

  // Mock guard that attaches a user to the request
  const mockJwtAuthGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'test-user-id', roles: ['user'] };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LibraryService)
      .useValue(mockLibraryService)
      .overrideProvider(SearchService)
      .useValue(mockSearchService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/library/my (GET) should simulate authenticated request', () => {
    return request(app.getHttpServer())
      .get('/library/my')
      .set('Authorization', 'Bearer fake-token') // Simulate sending a token
      .expect(200)
      .expect(JSON.stringify(mockLibraryService.getUserLibrary()));
  });

  it('/library/my/search (GET)', () => {
    return request(app.getHttpServer())
      .get('/library/my/search?query=test')
      .expect(200)
      .expect(JSON.stringify(mockSearchService.searchUserLibrary()));
  });

  it('/library/ownership/:gameId (GET)', () => {
    const gameId = 'some-game-id';
    return request(app.getHttpServer())
      .get(`/library/ownership/${gameId}`)
      .expect(200)
      .expect(JSON.stringify(mockLibraryService.checkGameOwnership()));
  });

  it('/library/add (POST) - internal endpoint', () => {
    const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order1',
        purchaseId: 'purchase1',
        purchasePrice: 10.0,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
    };
    return request(app.getHttpServer())
        .post('/library/add')
        .send(dto)
        .expect(201)
        .expect(JSON.stringify(mockLibraryService.addGameToLibrary(dto)));
  });

  it('/library/remove (DELETE) - internal endpoint', () => {
    const body = { userId: 'user1', gameId: 'game1' };
    return request(app.getHttpServer())
        .delete('/library/remove')
        .send(body)
        .expect(200);
  });
});
