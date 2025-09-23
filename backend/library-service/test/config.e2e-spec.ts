import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestAppModule } from './test-app.module';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

describe('Configuration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should load database configuration correctly', () => {
    const dataSource = app.get(DataSource);
    expect(dataSource).toBeDefined();
    expect(dataSource.options.type).toBe('postgres'); // PostgreSQL for tests too
  });

  it('should load cache configuration correctly', () => {
    const configService = app.get(ConfigService);
    // In test environment, we use memory cache instead of Redis
    expect(configService).toBeDefined();
  });

  it('should have test database configured', () => {
    const dataSource = app.get(DataSource);
    expect(dataSource.options.database).toBe('library_service_test');
    expect(dataSource.options.synchronize).toBe(true);
  });
});
