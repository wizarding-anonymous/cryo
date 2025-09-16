import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { LoggingService } from '../src/modules/logs/logging.service';

describe('SecurityController (e2e)', () => {
  let app: INestApplication;
  let loggingService: LoggingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    loggingService = app.get(LoggingService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('/security/check-login (POST) should perform a security check', async () => {
    const dto = { userId: '11111111-1111-1111-1111-111111111111', ip: '1.1.1.1' };
    const res = await request(app.getHttpServer())
      .post('/security/check-login')
      .send(dto)
      .expect(200);

    expect(typeof res.body.allowed).toBe('boolean');
    expect(typeof res.body.riskScore).toBe('number');

    // In mocked TestAppModule we only validate response shape
  });

  it('/security/report-event (POST) should log a custom event', async () => {
    const dto = {
      type: 'OTHER',
      ip: '1.2.3.4',
      userId: '22222222-2222-2222-2222-222222222222',
      data: { test: 'data' },
    };
    const spy = jest.spyOn(loggingService, 'logSecurityEvent');
    await request(app.getHttpServer())
      .post('/security/report-event')
      .send(dto)
      .expect(204);
    expect(spy).toHaveBeenCalled();
  });
});
