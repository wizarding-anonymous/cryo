import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { HealthService } from './health.service';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HealthService', () => {
  let service: HealthService;
  let mockRegistry: jest.Mocked<ServiceRegistryService>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    mockRegistry = {
      getAll: jest.fn(),
    } as any;

    mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ServiceRegistryService,
          useValue: mockRegistry,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkGateway', () => {
    it('should return gateway health status', async () => {
      const result = await service.checkGateway();

      expect(result).toEqual({
        status: expect.stringMatching(/^(ok|error)$/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });

      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      const result = await service.checkGateway();
      const timestamp = new Date(result.timestamp);
      
      expect(timestamp.toISOString()).toBe(result.timestamp);
      expect(Date.now() - timestamp.getTime()).toBeLessThan(1000); // within 1 second
    });

    it('should return process uptime', async () => {
      const result = await service.checkGateway();
      const actualUptime = Math.floor(process.uptime());
      
      expect(result.uptime).toBeCloseTo(actualUptime, 0);
    });
  });

  describe('checkServices', () => {
    it('should return empty array when no services registered', async () => {
      mockRegistry.getAll.mockReturnValue([]);

      const result = await service.checkServices();

      expect(result).toEqual([]);
    });

    it('should check health of all registered services', async () => {
      const mockServices = [
        {
          name: 'user-service',
          baseUrl: 'http://user-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
        {
          name: 'game-service',
          baseUrl: 'http://game-service:3002/',
          healthCheckPath: '/api/health',
          timeout: 3000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);

      mockedAxios.get
        .mockResolvedValueOnce({
          status: 200,
          data: { status: 'ok' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { status: 'healthy' },
        });

      const result = await service.checkServices();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'user-service',
        status: 'healthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
      });
      expect(result[1]).toEqual({
        name: 'game-service',
        status: 'healthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://user-service:3001/health',
        {
          timeout: 5000,
          validateStatus: expect.any(Function),
        },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://game-service:3002/api/health',
        {
          timeout: 3000,
          validateStatus: expect.any(Function),
        },
      );
    });

    it('should handle services with trailing slash in baseUrl', async () => {
      const mockServices = [
        {
          name: 'test-service',
          baseUrl: 'http://test-service:3000/',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockResolvedValue({ status: 200 });

      await service.checkServices();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://test-service:3000/health',
        expect.any(Object),
      );
    });

    it('should mark service as unhealthy when HTTP status is not 2xx', async () => {
      const mockServices = [
        {
          name: 'failing-service',
          baseUrl: 'http://failing-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockResolvedValue({
        status: 503,
        data: { error: 'Service unavailable' },
      });

      const result = await service.checkServices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'failing-service',
        status: 'unhealthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
        error: 'HTTP 503',
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockServices = [
        {
          name: 'unreachable-service',
          baseUrl: 'http://unreachable-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.checkServices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'unreachable-service',
        status: 'unhealthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
        error: 'ECONNREFUSED',
      });
    });

    it('should handle timeout errors', async () => {
      const mockServices = [
        {
          name: 'slow-service',
          baseUrl: 'http://slow-service:3001',
          healthCheckPath: '/health',
          timeout: 1000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 1000ms exceeded' });

      const result = await service.checkServices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'slow-service',
        status: 'unhealthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
        error: 'timeout of 1000ms exceeded',
      });
    });

    it('should handle unknown errors', async () => {
      const mockServices = [
        {
          name: 'error-service',
          baseUrl: 'http://error-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockRejectedValue(null);

      const result = await service.checkServices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'error-service',
        status: 'unhealthy',
        responseTime: expect.any(Number),
        lastCheck: expect.any(String),
        error: 'Unknown error',
      });
    });

    it('should measure response time accurately', async () => {
      const mockServices = [
        {
          name: 'test-service',
          baseUrl: 'http://test-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      
      // Mock a delay in the axios response
      mockedAxios.get.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ status: 200 }), 100)
        )
      );

      const result = await service.checkServices();

      expect(result[0].responseTime).toBeGreaterThanOrEqual(90);
      expect(result[0].responseTime).toBeLessThan(200);
    });

    it('should return valid timestamps', async () => {
      const mockServices = [
        {
          name: 'test-service',
          baseUrl: 'http://test-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const beforeCheck = Date.now();
      const result = await service.checkServices();
      const afterCheck = Date.now();

      const timestamp = new Date(result[0].lastCheck);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCheck);
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCheck);
      expect(timestamp.toISOString()).toBe(result[0].lastCheck);
    });

    it('should handle mixed service states', async () => {
      const mockServices = [
        {
          name: 'healthy-service',
          baseUrl: 'http://healthy-service:3001',
          healthCheckPath: '/health',
          timeout: 5000,
        },
        {
          name: 'unhealthy-service',
          baseUrl: 'http://unhealthy-service:3002',
          healthCheckPath: '/health',
          timeout: 5000,
        },
        {
          name: 'error-service',
          baseUrl: 'http://error-service:3003',
          healthCheckPath: '/health',
          timeout: 5000,
        },
      ];

      mockRegistry.getAll.mockReturnValue(mockServices as any);
      
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 503 })
        .mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.checkServices();

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('healthy');
      expect(result[1].status).toBe('unhealthy');
      expect(result[2].status).toBe('unhealthy');
    });
  });
});