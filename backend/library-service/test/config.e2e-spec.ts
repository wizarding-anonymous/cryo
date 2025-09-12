import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

describe('Configuration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
    expect(dataSource.options.type).toBe('postgres');
  });

  it('should load redis cache configuration correctly', () => {
    const configService = app.get(ConfigService);
    const redisHost = configService.get('redis.host');
    const redisPort = configService.get('redis.port');
    expect(redisHost).toBeDefined();
    expect(redisPort).toBeDefined();
  });

  it('should have migrations path configured', () => {
    const dataSource = app.get(DataSource);
    expect(dataSource.options.migrations).toBeDefined();
    // In a real test environment, you might check the path more robustly
    expect(Array.isArray(dataSource.options.migrations)).toBe(true);
  });
});
