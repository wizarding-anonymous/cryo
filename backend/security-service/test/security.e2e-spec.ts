import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { RateLimitService } from '../src/modules/security/rate-limit.service';

describe('SecurityController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('/security/check-login (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/security/check-login')
      .send({ userId: '11111111-1111-1111-1111-111111111111', ip: '1.1.1.1' });
    expect([200, 201]).toContain(res.status);
    expect(typeof res.body.allowed).toBe('boolean');
    expect(typeof res.body.riskScore).toBe('number');
  });

  it('/security/report-event (POST) -> 204', async () => {
    const res = await request(app.getHttpServer())
      .post('/security/report-event')
      .send({ type: 'OTHER' });
    expect(res.status).toBe(204);
  });

  it('RateLimitGuard -> 429 when exceeded', async () => {
    const rl = app.get<RateLimitService>(RateLimitService) as any;
    rl.checkRateLimit = jest.fn(async () => ({ allowed: false, remaining: 0, resetInSeconds: 60 }));
    const res = await request(app.getHttpServer())
      .post('/security/report-event')
      .send({ type: 'OTHER' });
    expect(res.status).toBe(429);
  });
});
