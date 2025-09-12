import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HealthCheckService, TypeOrmHealthIndicator, MicroserviceHealthIndicator } from '@nestjs/terminus';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  const mockHealthCheckService = {
    check: jest.fn().mockResolvedValue({
      status: 'ok',
      info: {
        database: { status: 'up' },
        'game-catalog-service': { status: 'up' },
      },
      error: {},
      details: {
        database: { status: 'up' },
        'game-catalog-service': { status: 'up' },
      },
    }),
  };

  beforeAll(async () => {
    // We need to mock the indicators because they would try to make real connections
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(HealthCheckService)
    .useValue(mockHealthCheckService)
    .overrideProvider(TypeOrmHealthIndicator)
    .useValue({ pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) })
    .overrideProvider(MicroserviceHealthIndicator)
    .useValue({ pingCheck: jest.fn().mockResolvedValue({ 'game-catalog-service': { status: 'up' } }) })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(mockHealthCheckService.check.mock.results[0].value);
  });
});
