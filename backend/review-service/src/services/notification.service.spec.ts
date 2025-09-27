import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { Review } from '../entities/review.entity';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('NotificationService', () => {
  let service: NotificationService;
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
        NotificationService,
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

    service = module.get<NotificationService>(NotificationService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values with reduced timeouts for tests
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        NOTIFICATION_SERVICE_URL: 'http://notification-service:3000',
        NOTIFICATION_REQUEST_TIMEOUT: 100, // Very short for tests
        NOTIFICATION_MAX_RETRIES: 0, // No retries for tests
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyNewReview', () => {
    it('should successfully notify about new review', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      const mockResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyNewReview(review, 'Test Game', 'Test User');

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review',
        {
          type: 'NEW_REVIEW',
          userId: 'user-456',
          gameId: 'game-789',
          reviewId: 'review-123',
          rating: 5,
          reviewText: 'Great game!',
          timestamp: '2023-01-01T00:00:00.000Z',
          metadata: {
            gameName: 'Test Game',
            userName: 'Test User',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          },
        }
      );
    });

    it('should handle notification service failure gracefully', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHttpService.post.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.notifyNewReview(review);

      expect(result).toBe(false);
    });

    it('should handle notification service returning failure response', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockResponse: AxiosResponse = {
        data: { success: false, message: 'Notification failed' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyNewReview(review);

      expect(result).toBe(false);
    });
  });

  describe('notifyReviewUpdate', () => {
    it('should successfully notify about review update', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Updated review!',
        rating: 4,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z'),
      };

      const mockResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.notifyReviewUpdate(review, 'Test Game', 'Test User');

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review-update',
        {
          type: 'REVIEW_UPDATED',
          userId: 'user-456',
          gameId: 'game-789',
          reviewId: 'review-123',
          rating: 4,
          reviewText: 'Updated review!',
          timestamp: '2023-01-02T00:00:00.000Z',
          metadata: {
            gameName: 'Test Game',
            userName: 'Test User',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          },
        }
      );
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
        notificationService: true,
      });
    });

    it('should return unhealthy status when service is unavailable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.getServiceHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        notificationService: false,
      });
    });
  });
});