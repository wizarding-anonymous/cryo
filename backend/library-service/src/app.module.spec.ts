import { ConfigService } from '@nestjs/config';
import { AppModule, createTypeOrmConfig, createCacheConfig } from './app.module';

describe('AppModule', () => {
  afterEach(() => {
    delete process.env.DATABASE_MAX_CONNECTIONS;
    delete process.env.DATABASE_MIN_CONNECTIONS;
    delete process.env.DATABASE_ACQUIRE_TIMEOUT;
    delete process.env.DATABASE_IDLE_TIMEOUT;
  });

  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('creates typeorm configuration with expected defaults', () => {
    process.env.DATABASE_MAX_CONNECTIONS = '30';
    process.env.DATABASE_MIN_CONNECTIONS = '2';
    process.env.DATABASE_ACQUIRE_TIMEOUT = '1000';
    process.env.DATABASE_IDLE_TIMEOUT = '2000';

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, unknown> = {
          'database.host': 'host',
          'database.port': 5432,
          'database.username': 'user',
          'database.password': 'pass',
          'database.database': 'db',
          'database.synchronize': false,
          'database.logging': false,
        };
        return defaults[key];
      }),
    } as unknown as ConfigService;

    const config = createTypeOrmConfig(mockConfigService);

    expect(config).toMatchObject({
      type: 'postgres',
      host: 'host',
      port: 5432,
      username: 'user',
      password: 'pass',
      database: 'db',
      synchronize: false,
      logging: false,
      migrationsTableName: 'migrations',
    });
    expect(config.extra).toMatchObject({
      max: 30,
      min: 2,
      acquireTimeoutMillis: 1000,
      idleTimeoutMillis: 2000,
    });
  });

  it('creates cache configuration using config service values', () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(120),
    } as unknown as ConfigService;

    const config = createCacheConfig(mockConfigService);

    expect(config).toEqual({ ttl: 120, max: 100 });
  });
});
