import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AchievementService } from './achievement.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AchievementService', () => {
  let service: AchievementService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
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

    service = module.get<AchievementService>(AchievementService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values with reduced timeouts for tests
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        ACHIEVEMENT_SERVICE_URL: 'http://achievement-service:3000',
        ACHIEVEMENT_REQUEST_TIMEOUT: 100, // Very short for tests
        ACHIEVEMENT_MAX_RETRIES: 0, // No retries for tests
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyFirstReview', () => {
    it('should successfully notify achievement service about first review', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      const mockResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      // Mock the HTTP service to return a successful response immediately
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(true);
    });

    it('should handle achievement service failure gracefully', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      mockHttpService.post.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(false);
    });

    it('should handle achievement service returning failure response', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      const mockResponse: AxiosResponse = {
        data: { success: false, message: 'Achievement already exists' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(false);
    });
  });

  describe('checkUserFirstReview', () => {
    it('should return true when it is user\'s first review', async () => {
      const userId = 'user-123';

      const mockResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.checkUserFirstReview(userId);

      expect(result).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://achievement-service:3000/achievements/user/user-123/first-review-status',
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          },
        }
      );
    });

    it('should return false when it is not user\'s first review', async () => {
      const userId = 'user-123';

      const mockResponse: AxiosResponse = {
        data: { isFirstReview: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.checkUserFirstReview(userId);

      expect(result).toBe(false);
    });

    it('should return false when achievement service is unavailable', async () => {
      const userId = 'user-123';

      mockHttpService.get.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.checkUserFirstReview(userId);

      expect(result).toBe(false);
    });
  });

  describe('getServiceHealth', () => {
    it('should return healthy status when service is available', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getServiceHealth();

      expect(result).toEqual({
        status: 'healthy',
        achievementService: true,
      });
    });

    it('should return unhealthy status when service is unavailable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.getServiceHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        achievementService: false,
      });
    });
  });
});