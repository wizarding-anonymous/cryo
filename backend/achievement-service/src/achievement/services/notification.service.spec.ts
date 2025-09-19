import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService, AchievementUnlockedNotification } from './notification.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: ConfigService;

  const mockNotification: AchievementUnlockedNotification = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    achievementId: '123e4567-e89b-12d3-a456-426614174001',
    achievementName: 'Первая покупка',
    achievementDescription: 'Купите свою первую игру',
    achievementPoints: 10,
    unlockedAt: '2024-01-01T00:00:00.000Z',
    notificationType: 'achievement_unlocked',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://notification-service:3000'),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset fetch mock
    (fetch as jest.Mock).mockReset();
  });

  describe('sendAchievementUnlockedNotification', () => {
    it('should send notification successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ notificationId: 'notif-123' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.sendAchievementUnlockedNotification(mockNotification);

      expect(result).toEqual({
        success: true,
        notificationId: 'notif-123',
        message: 'Notification sent successfully',
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://notification-service:3000/api/notifications/achievement',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
            'X-Service-Version': '1.0.0',
          },
          body: JSON.stringify(mockNotification),
        }
      );
    });

    it('should handle notification service error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.sendAchievementUnlockedNotification(mockNotification);

      expect(result).toEqual({
        success: false,
        message: 'Failed to send notification: Notification Service responded with 500: Internal Server Error',
      });
    });

    it('should handle network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.sendAchievementUnlockedNotification(mockNotification);

      expect(result).toEqual({
        success: false,
        message: 'Failed to send notification: Network error',
      });
    });

    it('should use custom notification service URL from config', async () => {
      const customUrl = 'http://custom-notification:4000';
      (configService.get as jest.Mock).mockReturnValue(customUrl);

      // Create new service instance with updated config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(customUrl),
            },
          },
        ],
      }).compile();

      const customService = module.get<NotificationService>(NotificationService);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ notificationId: 'notif-123' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await customService.sendAchievementUnlockedNotification(mockNotification);

      expect(fetch).toHaveBeenCalledWith(
        `${customUrl}/api/notifications/achievement`,
        expect.any(Object)
      );
    });
  });

  describe('checkNotificationServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      const mockResponse = { ok: true };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.checkNotificationServiceHealth();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://notification-service:3000/health',
        {
          method: 'GET',
          headers: {
            'X-Service-Name': 'achievement-service',
          },
        }
      );
    });

    it('should return false when service is unhealthy', async () => {
      const mockResponse = { ok: false };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.checkNotificationServiceHealth();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkNotificationServiceHealth();

      expect(result).toBe(false);
    });
  });

  describe('sendBatchNotifications', () => {
    it('should send multiple notifications', async () => {
      const notifications = [
        { ...mockNotification, achievementId: 'achievement-1' },
        { ...mockNotification, achievementId: 'achievement-2' },
      ];

      const mockResponse = {
        ok: true,
        json: jest.fn()
          .mockResolvedValueOnce({ notificationId: 'notif-1' })
          .mockResolvedValueOnce({ notificationId: 'notif-2' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const results = await service.sendBatchNotifications(notifications);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch', async () => {
      const notifications = [
        { ...mockNotification, achievementId: 'achievement-1' },
        { ...mockNotification, achievementId: 'achievement-2' },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ notificationId: 'notif-1' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue('Error'),
        });

      const results = await service.sendBatchNotifications(notifications);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});