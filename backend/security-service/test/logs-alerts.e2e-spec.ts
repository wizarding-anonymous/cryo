import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';
import { LoggingService } from '../src/modules/logs/logging.service';

describe('Logs/Alerts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /security/logs returns 403 without admin auth', async () => {
    // This endpoint requires admin authentication, so it should return 403
    await request(app.getHttpServer()).get('/security/logs').expect(403);
  });
  
  it('GET /security/alerts returns 403 without admin auth', async () => {
    // This endpoint requires admin authentication, so it should return 403
    await request(app.getHttpServer()).get('/security/alerts').expect(403);
  });
});
