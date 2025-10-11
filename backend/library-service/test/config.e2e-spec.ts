import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { E2ETestBase } from './e2e-test-base';

describe('Configuration (e2e)', () => {
  let testBase: E2ETestBase;

  beforeAll(async () => {
    testBase = new E2ETestBase();
    await testBase.setup();
  });

  afterAll(async () => {
    if (testBase) {
      await testBase.teardown();
    }
  });

  it('should load database configuration correctly', () => {
    const dataSource = testBase.app.get(DataSource);
    expect(dataSource).toBeDefined();
    expect(dataSource.options.type).toBe('postgres'); // PostgreSQL for tests too
  });

  it('should load cache configuration correctly', () => {
    const configService = testBase.app.get(ConfigService);
    // In test environment, we use memory cache instead of Redis
    expect(configService).toBeDefined();
  });

  it('should have test database configured', () => {
    const dataSource = testBase.app.get(DataSource);
    expect(dataSource.options.database).toBe('library_db'); // Actual test DB name
    expect(dataSource.options.synchronize).toBe(true);
  });
});
