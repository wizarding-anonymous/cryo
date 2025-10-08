import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { LibraryIntegrationService } from './library.service';
import { MetricsService } from '../../common/metrics/metrics.service';

describe('LibraryIntegrationService', () => {
  let service: LibraryIntegrationService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let metricsService: jest.Mocked<MetricsService>;

  const mockAddGameRequest = {
    userId: 'user-123',
    gameId: 'game-123',
    orderId: 'order-123',
    purchasePrice: 1999,
    currency: 'RUB',
  };

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockMetricsService = {
      recordIntegrationRequest: jest.fn(),
      recordIntegrationDuration: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryIntegrationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<LibraryIntegrationService>(LibraryIntegrationService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    metricsService = module.get(MetricsService);

    // Mock config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'LIBRARY_SERVICE_URL':
          return 'http://library-service:3000';
        case 'LIBRARY_SERVICE_TIMEOUT':
          return 5000;
        case 'LIBRARY_SERVICE_MAX_RETRIES':
          return defaultValue || 3;
        case 'LIBRARY_SERVICE_RETRY_DELAY':
          return defaultValue || 1000;
        default:
          return defaultValue;
      }
    });

    // Ensure the service gets the mocked URL and config
    (service as any).libraryServiceUrl = 'http://library-service:3000';
    (service as any).maxRetries = 3;
    (service as any).baseRetryDelay = 1000;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addGameToLibrary', () => {
    it('should add game to library successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true, message: 'Game added to library' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://library-service:3000/api/library/add',
        {
          userId: 'user-123',
          gameId: 'game-123',
          orderId: 'order-123',
          purchasePrice: 1999,
          currency: 'RUB',
        },
      );
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'addGame',
        'success',
      );
      expect(metricsService.recordIntegrationDuration).toHaveBeenCalledWith(
        'library',
        'addGame',
        expect.any(Number),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalledTimes(3); // Should retry 3 times
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'addGame',
        'error',
      );
    });

    it('should return false when all retries fail', async () => {
      const error = new Error('Persistent failure');
      httpService.post.mockReturnValue(throwError(() => error));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalledTimes(3); // Should retry 3 times
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'addGame',
        'error',
      );
      expect(metricsService.recordIntegrationDuration).toHaveBeenCalledWith(
        'library',
        'addGame',
        expect.any(Number),
      );
    });

    it('should return false when response status is not 201', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: false },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalledTimes(1); // Should only call once for non-network errors
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'addGame',
        'failed',
      );
      expect(metricsService.recordIntegrationDuration).toHaveBeenCalledWith(
        'library',
        'addGame',
        expect.any(Number),
      );
    });

    it('should retry with exponential backoff on failure', async () => {
      const error = new Error('Network error');
      const successResponse: AxiosResponse = {
        data: { success: true, message: 'Game added to library' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      // First call fails, second call succeeds
      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'addGame',
        'success',
      );
    });

    it('should respect max retries configuration', async () => {
      // Mock config to return 2 max retries
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          switch (key) {
            case 'LIBRARY_SERVICE_URL':
              return 'http://library-service:3000';
            case 'LIBRARY_SERVICE_MAX_RETRIES':
              return 2;
            case 'LIBRARY_SERVICE_RETRY_DELAY':
              return 100; // Short delay for testing
            default:
              return defaultValue;
          }
        },
      );

      // Recreate service with new config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LibraryIntegrationService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: configService },
          { provide: MetricsService, useValue: metricsService },
        ],
      }).compile();

      const testService = module.get<LibraryIntegrationService>(
        LibraryIntegrationService,
      );

      const error = new Error('Persistent failure');
      httpService.post.mockReturnValue(throwError(() => error));

      const result = await testService.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalledTimes(2); // Should only retry 2 times
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when service is available', async () => {
      const mockResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.checkHealth();

      expect(httpService.get).toHaveBeenCalledWith(
        'http://library-service:3000/api/health',
      );
      expect(result).toEqual({ status: 'up' });
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'healthCheck',
        'success',
      );
      expect(metricsService.recordIntegrationDuration).toHaveBeenCalledWith(
        'library',
        'healthCheck',
        expect.any(Number),
      );
    });

    it('should return unhealthy status when service is unavailable', async () => {
      const error = new Error('Service unavailable');
      httpService.get.mockReturnValue(throwError(() => error));

      const result = await service.checkHealth();

      expect(result).toEqual({
        status: 'down',
      });
      expect(metricsService.recordIntegrationRequest).toHaveBeenCalledWith(
        'library',
        'healthCheck',
        'error',
      );
      expect(metricsService.recordIntegrationDuration).toHaveBeenCalledWith(
        'library',
        'healthCheck',
        expect.any(Number),
      );
    });
  });
});
