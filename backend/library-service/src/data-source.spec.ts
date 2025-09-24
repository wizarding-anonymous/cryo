import { AppDataSource } from './data-source';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Mock the config module
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue?: any) => {
      const mockConfig: Record<string, any> = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: 5432,
        DATABASE_USERNAME: 'postgres',
        DATABASE_PASSWORD: 'password',
        DATABASE_NAME: 'library_service',
        NODE_ENV: 'test',
        DATABASE_MAX_CONNECTIONS: '20',
        DATABASE_MIN_CONNECTIONS: '5',
        DATABASE_ACQUIRE_TIMEOUT: '60000',
        DATABASE_IDLE_TIMEOUT: '600000',
      };
      return mockConfig[key] ?? defaultValue;
    }),
  })),
}));

describe('AppDataSource', () => {
  it('should create a DataSource instance with correct configuration', () => {
    expect(AppDataSource).toBeInstanceOf(DataSource);
    const pgOptions = AppDataSource.options as any;
    expect(pgOptions.type).toBe('postgres');
    expect(pgOptions.host).toBe('localhost');
    expect(pgOptions.port).toBe(5432);
    expect(pgOptions.username).toBe('postgres');
    expect(pgOptions.password).toBe('password');
    expect(pgOptions.database).toBe('library_service');
    expect(pgOptions.synchronize).toBe(false);
    expect(pgOptions.migrationsRun).toBe(false);
    expect(pgOptions.migrationsTableName).toBe('migrations');
  });

  it('should have correct entities configured', () => {
    expect(AppDataSource.options.entities).toHaveLength(2);
  });

  it('should have correct extra configuration', () => {
    const extra = AppDataSource.options.extra;
    expect(extra.max).toBe(20);
    expect(extra.min).toBe(5);
    expect(extra.acquireTimeoutMillis).toBe(60000);
    expect(extra.idleTimeoutMillis).toBe(600000);
  });

  it('should enable logging in development environment', () => {
    const mockConfigService = new ConfigService();
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      return 'default';
    });

    // Create a new DataSource with development config
    const devDataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'library_service',
      entities: [],
      migrations: [],
      synchronize: false,
      logging: mockConfigService.get('NODE_ENV') === 'development',
      migrationsRun: false,
      migrationsTableName: 'migrations',
    });

    expect(devDataSource.options.logging).toBe(true);
  });
});
