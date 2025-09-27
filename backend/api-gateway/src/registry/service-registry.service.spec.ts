import { ServiceRegistryService } from './service-registry.service';
import type { ServiceConfig } from '../config/service-config.interface';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ServiceRegistryService', () => {
  let service: ServiceRegistryService;
  let mockConfigService: any;

  const mockServices = {
    'user-service': {
      name: 'user-service',
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      retries: 1,
      healthCheckPath: '/health',
    },
    'game-catalog-service': {
      name: 'game-catalog-service',
      baseUrl: 'http://localhost:3002',
      timeout: 5000,
      retries: 1,
      healthCheckPath: '/health',
    },
  } as Record<string, ServiceConfig>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) =>
        key === 'services' ? mockServices : undefined,
      ),
    };
    service = new ServiceRegistryService(mockConfigService);
    jest.clearAllMocks();
  });

  describe('getServiceConfig', () => {
    it('should return service config for existing service', () => {
      const config = service.getServiceConfig('user-service');
      expect(config).toEqual(mockServices['user-service']);
    });

    it('should return undefined for non-existing service', () => {
      const config = service.getServiceConfig('non-existing-service');
      expect(config).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all service configs', () => {
      const allServices = service.getAll();
      expect(allServices).toHaveLength(2);
      expect(allServices).toEqual(Object.values(mockServices));
    });
  });

  describe('getAllServiceNames', () => {
    it('should return all service names', () => {
      const serviceNames = service.getAllServiceNames();
      expect(serviceNames).toHaveLength(2);
      expect(serviceNames).toContain('user-service');
      expect(serviceNames).toContain('game-catalog-service');
    });
  });

  describe('registerService', () => {
    it('should register a new service', async () => {
      const newService: ServiceConfig = {
        name: 'new-service',
        baseUrl: 'http://localhost:4000',
        timeout: 3000,
        retries: 2,
        healthCheckPath: '/health',
      };

      await service.registerService(newService);

      const config = service.getServiceConfig('new-service');
      expect(config).toEqual(newService);
      expect(service.getAll()).toHaveLength(3);
    });
  });

  describe('checkServiceHealth', () => {
    it('should return true for healthy service', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      });

      const isHealthy = await service.checkServiceHealth('user-service');

      expect(isHealthy).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          timeout: 3000,
          validateStatus: expect.any(Function),
        }),
      );
    });

    it('should return false for unhealthy service', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const isHealthy = await service.checkServiceHealth('user-service');

      expect(isHealthy).toBe(false);
    });

    it('should return false for non-existing service', async () => {
      const isHealthy = await service.checkServiceHealth(
        'non-existing-service',
      );

      expect(isHealthy).toBe(false);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should use shorter timeout for health checks', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      await service.checkServiceHealth('user-service');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 3000, // Should be min(5000, 3000) = 3000
        }),
      );
    });
  });
});
