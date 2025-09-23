import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createDatabaseConfig } from './database.config';

describe('Database Configuration', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'database.host': 'localhost',
                'database.port': 5432,
                'database.username': 'postgres',
                'database.password': 'password',
                'database.database': 'library_service_test',
                'database.synchronize': false,
                'database.logging': false,
                'database.maxConnections': 20,
                'database.minConnections': 5,
                'database.acquireTimeout': 60000,
                'database.idleTimeout': 600000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should create database configuration', () => {
    const config = createDatabaseConfig(configService) as any;

    expect(config).toBeDefined();
    expect(config.type).toBe('postgres');
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('postgres');
    expect(config.password).toBe('password');
    expect(config.database).toBe('library_service_test');
    expect(config.synchronize).toBe(false);
    expect(config.logging).toBe(false);
    expect(config.entities).toHaveLength(2);
    expect(config.extra.max).toBe(20);
    expect(config.extra.min).toBe(5);
  });

  it('should include correct entities', () => {
    const config = createDatabaseConfig(configService) as any;

    expect(config.entities).toHaveLength(2);
    // Entities should be the actual entity classes
    expect(config.entities[0].name).toBe('LibraryGame');
    expect(config.entities[1].name).toBe('PurchaseHistory');
  });

  it('should configure migrations correctly', () => {
    const config = createDatabaseConfig(configService) as any;

    expect(config.migrations).toBeDefined();
    expect(config.migrationsTableName).toBe('migrations');
    expect(config.migrationsRun).toBe(false); // Should be false in test environment
  });

  it('should configure connection pooling', () => {
    const config = createDatabaseConfig(configService) as any;

    expect(config.extra).toBeDefined();
    expect(config.extra.max).toBe(20);
    expect(config.extra.min).toBe(5);
    expect(config.extra.acquireTimeoutMillis).toBe(60000);
    expect(config.extra.idleTimeoutMillis).toBe(600000);
  });
});
