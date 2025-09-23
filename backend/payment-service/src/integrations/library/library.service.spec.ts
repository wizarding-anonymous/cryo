import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { LibraryIntegrationService } from './library.service';

describe('LibraryIntegrationService', () => {
  let service: LibraryIntegrationService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

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
      ],
    }).compile();

    service = module.get<LibraryIntegrationService>(LibraryIntegrationService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);

    // Mock config values
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'LIBRARY_SERVICE_URL':
          return 'http://library-service:3000';
        case 'LIBRARY_SERVICE_TIMEOUT':
          return 5000;
        default:
          return undefined;
      }
    });

    // Ensure the service gets the mocked URL
    (service as any).libraryServiceUrl = 'http://library-service:3000';
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
    });

    it('should handle HTTP errors gracefully', async () => {
      const error = new Error('Network error');
      httpService.post.mockReturnValue(throwError(() => error));

      // Should not throw, but log the error
      await expect(
        service.addGameToLibrary(mockAddGameRequest),
      ).resolves.not.toThrow();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should return false when all retries fail', async () => {
      const error = new Error('Persistent failure');
      httpService.post.mockReturnValue(throwError(() => error));

      const result = await service.addGameToLibrary(mockAddGameRequest);

      expect(result).toBe(false);
      expect(httpService.post).toHaveBeenCalled();
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
      expect(httpService.post).toHaveBeenCalled();
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
    });

    it('should return unhealthy status when service is unavailable', async () => {
      const error = new Error('Service unavailable');
      httpService.get.mockReturnValue(throwError(() => error));

      const result = await service.checkHealth();

      expect(result).toEqual({
        status: 'down',
      });
    });
  });
});
