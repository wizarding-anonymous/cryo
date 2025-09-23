import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from './database.config';

describe('DatabaseConfig', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                DB_HOST: 'localhost',
                DB_PORT: 5432,
                DB_USERNAME: 'postgres',
                DB_PASSWORD: 'password',
                DB_NAME: 'social_service_test',
                NODE_ENV: 'test',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should return correct database configuration', () => {
    const config = getDatabaseConfig(configService);

    expect(config.type).toBe('postgres');
    expect((config as any).host).toBe('localhost');
    expect((config as any).port).toBe(5432);
    expect((config as any).username).toBe('postgres');
    expect((config as any).password).toBe('password');
    expect((config as any).database).toBe('social_service_test');
    expect(config.entities).toEqual(expect.any(Array));
    expect(config.synchronize).toBe(true); // NODE_ENV is 'test', not 'production'
    expect(config.logging).toBe(false); // NODE_ENV is 'test', not 'development'
    expect(config.migrations).toEqual(['dist/migrations/*{.ts,.js}']);
    expect(config.migrationsRun).toBe(false);
    expect((config as any).ssl).toBe(false);
    expect((config as any).extra).toEqual({
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    });
  });

  it('should use default values when environment variables are not set', () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    } as any;

    const config = getDatabaseConfig(mockConfigService);

    expect((config as any).host).toBe('localhost');
    expect((config as any).port).toBe(5432);
    expect((config as any).username).toBe('postgres');
    expect((config as any).password).toBe('password');
    expect((config as any).database).toBe('social_service');
  });

  it('should disable synchronize in production', () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        return defaultValue;
      }),
    } as any;

    const config = getDatabaseConfig(mockConfigService);

    expect(config.synchronize).toBe(false);
    expect((config as any).ssl).toEqual({ rejectUnauthorized: false });
  });
});
