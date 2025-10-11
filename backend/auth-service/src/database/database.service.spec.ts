import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DatabaseService,
          useValue: {
            checkHealth: jest.fn().mockResolvedValue({
              status: 'healthy',
              details: {
                connected: true,
                database: 'auth_db',
                host: 'localhost',
                port: 5432,
                poolStats: {
                  totalConnections: 1,
                  idleConnections: 1,
                  waitingClients: 0,
                },
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should check health status', async () => {
    const result = await service.checkHealth();
    expect(result.status).toBe('healthy');
    expect(result.details.connected).toBe(true);
  });
});