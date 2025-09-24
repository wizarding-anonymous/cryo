import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from './database.config';

describe('DatabaseConfig', () => {
  let databaseConfig: DatabaseConfig;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseConfig,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                NODE_ENV: 'test',
                DB_HOST: 'localhost',
                DB_PORT: 5432,
                DB_USER: 'test_user',
                DB_PASSWORD: 'test_password',
                DB_NAME: 'test_security_service',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    databaseConfig = module.get<DatabaseConfig>(DatabaseConfig);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(databaseConfig).toBeDefined();
  });

  it('should create TypeORM options with discrete database config', () => {
    const options = databaseConfig.createTypeOrmOptions();

    expect(options).toEqual({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test_user',
      password: 'test_password',
      database: 'test_security_service',
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      migrations: [expect.stringContaining('/migrations/*{.js,.ts}')],
    });
  });

  it('should create TypeORM options with DATABASE_URL when provided', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DATABASE_URL') {
        return 'postgres://user:pass@localhost:5432/testdb';
      }
      if (key === 'NODE_ENV') {
        return 'production';
      }
      return undefined;
    });

    const options = databaseConfig.createTypeOrmOptions();

    expect(options).toEqual({
      type: 'postgres',
      url: 'postgres://user:pass@localhost:5432/testdb',
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      migrations: [expect.stringContaining('/migrations/*{.js,.ts}')],
      ssl: { rejectUnauthorized: false },
    });
  });

  it('should include SSL config for production environment', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DATABASE_URL') {
        return 'postgres://user:pass@localhost:5432/testdb';
      }
      if (key === 'NODE_ENV') {
        return 'production';
      }
      return undefined;
    });

    const options = databaseConfig.createTypeOrmOptions();

    expect((options as any).ssl).toEqual({ rejectUnauthorized: false });
  });
});
