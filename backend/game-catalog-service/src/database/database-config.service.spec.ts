import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfigService } from './database-config.service';

describe('DatabaseConfigService', () => {
  let service: DatabaseConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                POSTGRES_HOST: 'localhost',
                POSTGRES_PORT: 5432,
                POSTGRES_USER: 'testuser',
                POSTGRES_PASSWORD: 'testpass',
                POSTGRES_DB: 'testdb',
                NODE_ENV: 'test',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseConfigService>(DatabaseConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create TypeORM options', () => {
    const options = service.createTypeOrmOptions() as any;
    
    expect(options).toBeDefined();
    expect(options.type).toBe('postgres');
    expect(options.host).toBe('localhost');
    expect(options.port).toBe(5432);
    expect(options.username).toBe('testuser');
    expect(options.password).toBe('testpass');
    expect(options.database).toBe('testdb');
    expect(options.synchronize).toBe(false);
    expect(options.autoLoadEntities).toBe(true);
  });

  it('should validate configuration successfully', () => {
    const isValid = service.validateConfig();
    expect(isValid).toBe(true);
  });

  it('should return connection info', () => {
    const connectionInfo = service.getConnectionInfo();
    expect(connectionInfo).toBe('localhost:5432/testdb');
  });

  it('should fail validation with missing config', () => {
    const mockConfigService = {
      get: jest.fn(() => undefined),
    };
    
    const testService = new DatabaseConfigService(mockConfigService as any);
    const isValid = testService.validateConfig();
    
    expect(isValid).toBe(false);
  });
});