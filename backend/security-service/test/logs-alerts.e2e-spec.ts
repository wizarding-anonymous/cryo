import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { AuthService } from '../src/common/auth/auth.service';

describe('Logs/Alerts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /security/logs requires admin and returns paginated', async () => {
    const res = await request(app.getHttpServer())
      .get('/security/logs')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /security/alerts requires admin and returns paginated', async () => {
    const res = await request(app.getHttpServer())
      .get('/security/alerts')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /security/alerts returns 403 for non-admin', async () => {
    const auth = app.get<AuthService>(AuthService) as any;
    auth.verifyBearerToken = jest.fn(async () => ({ id: 'u1', roles: [] }));
    const res = await request(app.getHttpServer())
      .get('/security/alerts')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });
});
