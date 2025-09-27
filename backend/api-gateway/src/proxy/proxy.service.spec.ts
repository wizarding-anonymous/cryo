import axios from 'axios';
import { ProxyService } from './proxy.service';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { ServiceUnavailableException } from '../common/exceptions/service-unavailable.exception';
import { ProxyTimeoutException } from '../common/exceptions/proxy-timeout.exception';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('ProxyService', () => {
  let proxyService: ProxyService;
  let mockRegistry: jest.Mocked<ServiceRegistryService>;

  const mockServiceConfig = {
    name: 'user-service',
    baseUrl: 'http://user-service:3001',
    timeout: 5000,
    retries: 2,
    healthCheckPath: '/health',
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
    },
  };

  beforeEach(() => {
    mockRegistry = {
      getServiceConfig: jest.fn(),
    } as any;

    proxyService = new ProxyService(mockRegistry);
    mockedAxios.mockReset();
  });

  describe('forward', () => {
    it('should forward successful response with correct headers', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { id: 1, name: 'John' },
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'test-value',
        },
      });

      const req = {
        method: 'GET',
        path: '/api/users/1',
        url: '/api/users/1?include=profile',
        headers: {
          authorization: 'Bearer token123',
          'user-agent': 'test-client',
        },
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ id: 1, name: 'John' });
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['x-custom-header']).toBe('test-value');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://user-service:3001/users/1?include=profile',
          method: 'GET',
          timeout: 5000,
        }),
      );
    });

    it('should handle POST requests with body', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockResolvedValue({
        status: 201,
        data: { id: 2, name: 'Jane' },
        headers: { 'content-type': 'application/json' },
      });

      const req = {
        method: 'POST',
        path: '/api/users',
        url: '/api/users',
        headers: { 'content-type': 'application/json' },
        body: { name: 'Jane', email: 'jane@example.com' },
      } as any;

      const result = await proxyService.forward(req);

      expect(result.statusCode).toBe(201);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: { name: 'Jane', email: 'jane@example.com' },
        }),
      );
    });

    it('should return 404 for unknown routes', async () => {
      const req = {
        method: 'GET',
        path: '/api/unknown-service/test',
        url: '/api/unknown-service/test',
        headers: {},
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);

      expect(result.statusCode).toBe(404);
      expect(result.body).toEqual({
        error: 'NOT_FOUND',
        message: 'No route for GET /api/unknown-service/test',
      });
    });

    it('should throw ServiceUnavailableException when service config not found', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(undefined);

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      await expect(proxyService.forward(req)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should retry on 5xx errors and succeed', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios
        .mockRejectedValueOnce({
          response: {
            status: 500,
            headers: {},
            data: { error: 'Internal Error' },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          headers: { 'content-type': 'application/json' },
        });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ success: true });
      expect(mockedAxios).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue({
        response: {
          status: 400,
          headers: { 'content-type': 'application/json' },
          data: { error: 'Bad Request' },
        },
      });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Bad Request' });
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });

    it('should throw ProxyTimeoutException on timeout', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      await expect(proxyService.forward(req)).rejects.toThrow(
        ProxyTimeoutException,
      );
    });

    it('should handle array headers correctly', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { ok: true },
        headers: {
          'set-cookie': ['session=abc123', 'csrf=xyz789'],
          'cache-control': 'no-cache',
        },
      });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);

      expect(result.headers['set-cookie']).toBe('session=abc123, csrf=xyz789');
      expect(result.headers['cache-control']).toBe('no-cache');
    });

    it('should build forward headers correctly', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { ok: true },
        headers: {},
      });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {
          authorization: 'Bearer token123',
          'user-agent': 'test-client',
          host: 'api.example.com',
          connection: 'keep-alive', // should be filtered out
          'content-length': '100', // should be filtered out
          'x-forwarded-for': '192.168.1.1',
        },
        body: undefined,
      } as any;

      await proxyService.forward(req);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer token123',
            'user-agent': 'test-client',
            'x-forwarded-proto': 'http',
            'x-forwarded-host': 'api.example.com',
            'x-forwarded-for': '192.168.1.1',
          }),
        }),
      );

      const callArgs = mockedAxios.mock.calls[0][0];
      expect(callArgs.headers).not.toHaveProperty('connection');
      expect(callArgs.headers).not.toHaveProperty('content-length');
      expect(callArgs.headers).not.toHaveProperty('host');
    });
  });

  describe('service resolution', () => {
    it('should resolve user service routes correctly', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockResolvedValue({ status: 200, data: {}, headers: {} });

      const testCases = [
        { path: '/api/auth/login', expectedService: 'user-service' },
        { path: '/api/users/profile', expectedService: 'user-service' },
        { path: '/api/users/123', expectedService: 'user-service' },
      ];

      for (const testCase of testCases) {
        const req = {
          method: 'GET',
          path: testCase.path,
          url: testCase.path,
          headers: {},
          body: undefined,
        } as any;

        await proxyService.forward(req);
        expect(mockRegistry.getServiceConfig).toHaveBeenCalledWith(
          testCase.expectedService,
        );
      }
    });

    it('should resolve game service routes correctly', async () => {
      const gameServiceConfig = {
        ...mockServiceConfig,
        name: 'game-catalog-service',
      };
      mockRegistry.getServiceConfig.mockReturnValue(gameServiceConfig);
      mockedAxios.mockResolvedValue({ status: 200, data: {}, headers: {} });

      const req = {
        method: 'GET',
        path: '/api/games/popular',
        url: '/api/games/popular',
        headers: {},
        body: undefined,
      } as any;

      await proxyService.forward(req);
      expect(mockRegistry.getServiceConfig).toHaveBeenCalledWith(
        'game-catalog-service',
      );
    });

    it('should resolve payment service routes correctly', async () => {
      const paymentServiceConfig = {
        ...mockServiceConfig,
        name: 'payment-service',
      };
      mockRegistry.getServiceConfig.mockReturnValue(paymentServiceConfig);
      mockedAxios.mockResolvedValue({ status: 200, data: {}, headers: {} });

      const req = {
        method: 'POST',
        path: '/api/payments/create',
        url: '/api/payments/create',
        headers: {},
        body: { amount: 100 },
      } as any;

      await proxyService.forward(req);
      expect(mockRegistry.getServiceConfig).toHaveBeenCalledWith(
        'payment-service',
      );
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after failure threshold', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      // First 3 failures should trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(proxyService.forward(req)).rejects.toThrow();
      }

      // 4th request should be blocked by circuit breaker
      await expect(proxyService.forward(req)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should reset circuit breaker after timeout', async () => {
      const shortResetConfig = {
        ...mockServiceConfig,
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 100, // 100ms for testing
          monitoringPeriod: 60000,
        },
      };

      mockRegistry.getServiceConfig.mockReturnValue(shortResetConfig);
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      // Trigger circuit breaker
      await expect(proxyService.forward(req)).rejects.toThrow();
      await expect(proxyService.forward(req)).rejects.toThrow();

      // Should be blocked
      await expect(proxyService.forward(req)).rejects.toThrow(
        ServiceUnavailableException,
      );

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should allow one request (half-open state)
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: { recovered: true },
        headers: {},
      });

      const result = await proxyService.forward(req);
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ recovered: true });
    });

    it('should close circuit breaker on successful request', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      // First, trigger some failures
      mockedAxios.mockRejectedValueOnce(new Error('Network error'));
      await expect(proxyService.forward(req)).rejects.toThrow();

      // Then succeed
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        headers: {},
      });

      const result = await proxyService.forward(req);
      expect(result.statusCode).toBe(200);

      // Circuit should be closed now, allowing more requests
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        headers: {},
      });

      const result2 = await proxyService.forward(req);
      expect(result2.statusCode).toBe(200);
    });
  });

  describe('exponential backoff', () => {
    it('should implement exponential backoff between retries', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);

      const startTime = Date.now();
      mockedAxios.mockRejectedValue({
        response: { status: 500, headers: {}, data: { error: 'Server Error' } },
      });

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      const result = await proxyService.forward(req);
      const endTime = Date.now();

      // Should have taken at least 100ms + 200ms for backoff delays
      expect(endTime - startTime).toBeGreaterThan(250);
      expect(result.statusCode).toBe(500);
      expect(mockedAxios).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('monitoring and admin methods', () => {
    it('should return circuit breaker statistics', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      // Trigger some failures to create circuit breaker state
      await expect(proxyService.forward(req)).rejects.toThrow();

      const stats = proxyService.getCircuitBreakerStats();

      expect(stats['user-service']).toBeDefined();
      expect(stats['user-service'].serviceName).toBe('user-service');
      expect(stats['user-service'].state).toBe('closed');
      expect(stats['user-service'].failures).toBeGreaterThan(0);
    });

    it('should reset circuit breaker for specific service', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const req = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      // Trigger failures to create circuit breaker state
      await expect(proxyService.forward(req)).rejects.toThrow();

      // Verify state exists
      let stats = proxyService.getCircuitBreakerStats();
      expect(stats['user-service']).toBeDefined();

      // Reset specific service
      proxyService.resetCircuitBreaker('user-service');

      // Verify state is cleared
      stats = proxyService.getCircuitBreakerStats();
      expect(stats['user-service']).toBeUndefined();
    });

    it('should reset all circuit breakers', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(mockServiceConfig);
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const req1 = {
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        headers: {},
        body: undefined,
      } as any;

      const req2 = {
        method: 'GET',
        path: '/api/games',
        url: '/api/games',
        headers: {},
        body: undefined,
      } as any;

      // Trigger failures for multiple services
      await expect(proxyService.forward(req1)).rejects.toThrow();
      await expect(proxyService.forward(req2)).rejects.toThrow();

      // Verify states exist
      let stats = proxyService.getCircuitBreakerStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);

      // Reset all
      proxyService.resetAllCircuitBreakers();

      // Verify all states are cleared
      stats = proxyService.getCircuitBreakerStats();
      expect(Object.keys(stats).length).toBe(0);
    });
  });
});
