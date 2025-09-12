import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HistoryService } from '../src/history/history.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

describe('HistoryController (e2e)', () => {
  let app: INestApplication;

  const mockHistoryService = {
    getPurchaseHistory: jest.fn(() => ({ history: [], pagination: { total: 0 } })),
    searchPurchaseHistory: jest.fn(() => ({ history: [], pagination: { total: 0 } })),
    getPurchaseDetails: jest.fn(() => ({ id: 'purchase1' })),
    createPurchaseRecord: jest.fn((dto) => ({ id: 'new-purchase', ...dto })),
  };

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
      .overrideProvider(HistoryService)
      .useValue(mockHistoryService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/library/history (GET)', () => {
    return request(app.getHttpServer())
      .get('/library/history')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)
      .expect(JSON.stringify(mockHistoryService.getPurchaseHistory()));
  });

  it('/library/history/search (GET)', () => {
    return request(app.getHttpServer())
      .get('/library/history/search?query=test')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)
      .expect(JSON.stringify(mockHistoryService.searchPurchaseHistory()));
  });

  it('/library/history/:purchaseId (GET)', () => {
    const purchaseId = 'purchase1';
    return request(app.getHttpServer())
      .get(`/library/history/${purchaseId}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(200)
      .expect(JSON.stringify(mockHistoryService.getPurchaseDetails()));
  });

  it('/library/history (POST) - internal endpoint', () => {
      const dto = { userId: 'user1', gameId: 'game1' }; // Simplified DTO
      return request(app.getHttpServer())
        .post('/library/history')
        .send(dto)
        .expect(201)
        .expect(JSON.stringify(mockHistoryService.createPurchaseRecord(dto)));
  });
});
