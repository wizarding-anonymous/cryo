import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let dataSource: jest.Mocked<any>;
  let configService: jest.Mocked<any>;

  beforeEach(() => {
    // Создаем моки напрямую
    dataSource = {
      query: jest.fn(),
      isInitialized: true,
      driver: {
        pool: {
          totalCount: 10,
          idleCount: 5,
          waitingCount: 0,
        },
      },
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          DATABASE_NAME: 'test_db',
          DATABASE_HOST: 'localhost',
          DATABASE_PORT: 5432,
          DATABASE_MAX_CONNECTIONS: 20,
          DATABASE_MIN_CONNECTIONS: 5,
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    } as any;

    // Создаем DatabaseService с моками
    service = new DatabaseService(dataSource, configService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should check health status when database is healthy', async () => {
    // Arrange
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    // Act
    const result = await service.checkHealth();

    // Assert
    expect(result.status).toBe('healthy');
    expect(result.details.connected).toBe(true);
    expect(result.details.database).toBe('test_db');
    expect(result.details.host).toBe('localhost');
    expect(result.details.port).toBe(5432);
    expect(result.details.poolStats).toBeDefined();
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('should return unhealthy status when database query fails', async () => {
    // Arrange
    const error = new Error('Connection failed');
    dataSource.query.mockRejectedValue(error);
    dataSource.isInitialized = false;

    // Act
    const result = await service.checkHealth();

    // Assert
    expect(result.status).toBe('unhealthy');
    expect(result.details.connected).toBe(false);
    expect(result.details.error).toBe('Connection failed');
  });

  it('should get connection pool statistics', async () => {
    // Arrange
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    // Act
    const result = await service.checkHealth();

    // Assert
    expect(result.details.poolStats).toEqual({
      totalConnections: 10,
      idleConnections: 5,
      waitingClients: 0,
      maxConnections: 20,
      minConnections: 5,
    });
  });
});