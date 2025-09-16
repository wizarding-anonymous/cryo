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

  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /security/logs returns paginated logs', async () => {
    // First, create a log event to ensure there's data
    const loggingService = app.get(LoggingService);
    await loggingService.logSecurityEvent({
      type: SecurityEventType.OTHER,
      ip: '1.2.3.4',
      data: { info: 'test-log' },
    });

    const res = await request(app.getHttpServer()).get('/security/logs').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
  
  it('GET /security/alerts returns paginated alerts', async () => {
    const res = await request(app.getHttpServer()).get('/security/alerts').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});
