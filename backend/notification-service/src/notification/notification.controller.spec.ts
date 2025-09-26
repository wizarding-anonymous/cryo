import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  GetNotificationsDto,
  UpdateNotificationSettingsDto,
  PaymentEventDto,
  SocialEventDto,
  AchievementEventDto,
  ReviewEventDto,
  GameCatalogEventDto,
  LibraryEventDto,
} from './dto';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../common/enums';
import { AuthenticatedRequest } from '../common/interfaces';

const mockUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const mockAdminUserId = 'admin-user-id';
const mockDate = new Date('2024-01-01T10:00:00.000Z');

const mockNotificationDto = {
  id: 'notif-id',
  userId: mockUserId,
  type: NotificationType.PURCHASE,
  title: 'Test Notification',
  message: 'Test message',
  isRead: false,
  priority: NotificationPriority.NORMAL,
  channels: [NotificationChannel.IN_APP],
  createdAt: mockDate,
};

const mockSettingsDto = {
  id: 'settings-id',
  userId: mockUserId,
  inAppNotifications: true,
  emailNotifications: true,
  friendRequests: true,
  gameUpdates: true,
  achievements: true,
  purchases: true,
  systemNotifications: true,
  updatedAt: mockDate,
};

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationService;

  const mockNotificationService = {
    getUserNotifications: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    markAsRead: jest.fn(),
    createNotification: jest.fn(),
    getUserNotificationStats: jest.fn(),
    createBulkNotifications: jest.fn(),
    getCacheStats: jest.fn(),
    clearSettingsCache: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserNotifications', () => {
    const mockRequest: AuthenticatedRequest = {
      user: { id: mockUserId, isAdmin: false },
    } as AuthenticatedRequest;

    it('should return user notifications when user accesses own notifications', async () => {
      const query: GetNotificationsDto = { limit: 10, offset: 0 };
      const expectedResult = {
        data: [mockNotificationDto],
        total: 1,
        limit: 10,
        offset: 0,
      };

      mockNotificationService.getUserNotifications.mockResolvedValue(expectedResult);

      const result = await controller.getUserNotifications(mockRequest, mockUserId, query);

      expect(result).toEqual(expectedResult);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should throw ForbiddenException when user tries to access other user notifications', async () => {
      const query: GetNotificationsDto = { limit: 10, offset: 0 };
      const otherUserId = 'other-user-id';

      await expect(
        controller.getUserNotifications(mockRequest, otherUserId, query)
      ).rejects.toThrow(ForbiddenException);

      expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
    });

    it('should allow admin to access any user notifications', async () => {
      const adminRequest: AuthenticatedRequest = {
        user: { id: mockAdminUserId, isAdmin: true },
      } as AuthenticatedRequest;
      const query: GetNotificationsDto = { limit: 10, offset: 0 };
      const expectedResult = {
        data: [mockNotificationDto],
        total: 1,
        limit: 10,
        offset: 0,
      };

      mockNotificationService.getUserNotifications.mockResolvedValue(expectedResult);

      const result = await controller.getUserNotifications(adminRequest, mockUserId, query);

      expect(result).toEqual(expectedResult);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(mockUserId, query);
    });
  });

  describe('getSettings', () => {
    const mockRequest: AuthenticatedRequest = {
      user: { id: mockUserId, isAdmin: false },
    } as AuthenticatedRequest;

    it('should return user settings when user accesses own settings', async () => {
      mockNotificationService.getSettings.mockResolvedValue(mockSettingsDto);

      const result = await controller.getSettings(mockRequest, mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(notificationService.getSettings).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException when user tries to access other user settings', async () => {
      const otherUserId = 'other-user-id';

      await expect(
        controller.getSettings(mockRequest, otherUserId)
      ).rejects.toThrow(ForbiddenException);

      expect(notificationService.getSettings).not.toHaveBeenCalled();
    });

    it('should allow admin to access any user settings', async () => {
      const adminRequest: AuthenticatedRequest = {
        user: { id: mockAdminUserId, isAdmin: true },
      } as AuthenticatedRequest;

      mockNotificationService.getSettings.mockResolvedValue(mockSettingsDto);

      const result = await controller.getSettings(adminRequest, mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(notificationService.getSettings).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('updateSettings', () => {
    const mockRequest: AuthenticatedRequest = {
      user: { id: mockUserId, isAdmin: false },
    } as AuthenticatedRequest;

    it('should update user settings when user updates own settings', async () => {
      const updateDto: UpdateNotificationSettingsDto = { emailNotifications: false };
      const updatedSettings = { ...mockSettingsDto, ...updateDto };

      mockNotificationService.updateSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(mockRequest, mockUserId, updateDto);

      expect(result).toEqual(updatedSettings);
      expect(notificationService.updateSettings).toHaveBeenCalledWith(mockUserId, updateDto);
    });

    it('should throw ForbiddenException when user tries to update other user settings', async () => {
      const updateDto: UpdateNotificationSettingsDto = { emailNotifications: false };
      const otherUserId = 'other-user-id';

      await expect(
        controller.updateSettings(mockRequest, otherUserId, updateDto)
      ).rejects.toThrow(ForbiddenException);

      expect(notificationService.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    const mockRequest: AuthenticatedRequest = {
      user: { id: mockUserId, isAdmin: false },
    } as AuthenticatedRequest;

    it('should mark notification as read', async () => {
      const notificationId = 'notif-id';
      mockNotificationService.markAsRead.mockResolvedValue(undefined);

      await controller.markAsRead(mockRequest, notificationId);

      expect(notificationService.markAsRead).toHaveBeenCalledWith(notificationId, mockUserId);
    });

    it('should handle NotFoundException from service', async () => {
      const notificationId = 'non-existent-id';
      mockNotificationService.markAsRead.mockRejectedValue(
        new NotFoundException('Notification not found')
      );

      await expect(
        controller.markAsRead(mockRequest, notificationId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createNotification (Admin only)', () => {
    const adminRequest: AuthenticatedRequest = {
      user: { id: mockAdminUserId, isAdmin: true },
    } as AuthenticatedRequest;

    it('should create notification when called by admin', async () => {
      const createDto: CreateNotificationDto = {
        userId: mockUserId,
        type: NotificationType.SYSTEM,
        title: 'Admin Message',
        message: 'Important system message',
      };

      mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

      const result = await controller.createNotification(adminRequest, createDto);

      expect(result).toEqual(mockNotificationDto);
      expect(notificationService.createNotification).toHaveBeenCalledWith(createDto);
    });
  });

  describe('Webhook Endpoints', () => {
    describe('handlePaymentCompletedWebhook', () => {
      it('should handle payment completed webhook', async () => {
        const eventDto: PaymentEventDto = {
          userId: mockUserId,
          eventType: 'payment.completed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            amount: 1999,
            currency: 'RUB',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handlePaymentCompletedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Покупка успешно завершена',
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          })
        );
      });
    });

    describe('handlePaymentFailedWebhook', () => {
      it('should handle payment failed webhook', async () => {
        const eventDto: PaymentEventDto = {
          userId: mockUserId,
          eventType: 'payment.failed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            amount: 1999,
            currency: 'RUB',
            errorMessage: 'Insufficient funds',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handlePaymentFailedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Ошибка при оплате',
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          })
        );
      });
    });

    describe('handleFriendRequestWebhook', () => {
      it('should handle friend request webhook', async () => {
        const eventDto: SocialEventDto = {
          userId: mockUserId,
          eventType: 'friend.request',
          data: {
            fromUserId: 'friend-user-id',
            fromUserName: 'Friend User',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleFriendRequestWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.FRIEND_REQUEST,
            title: 'Новая заявка в друзья',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleFriendAcceptedWebhook', () => {
      it('should handle friend accepted webhook', async () => {
        const eventDto: SocialEventDto = {
          userId: mockUserId,
          eventType: 'friend.accepted',
          data: {
            fromUserId: 'friend-user-id',
            fromUserName: 'Friend User',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleFriendAcceptedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.FRIEND_REQUEST,
            title: 'Заявка в друзья принята',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleMessageWebhook', () => {
      it('should handle message webhook', async () => {
        const eventDto: SocialEventDto = {
          userId: mockUserId,
          eventType: 'message.received',
          data: {
            fromUserId: 'sender-user-id',
            fromUserName: 'Sender User',
            messageId: 'message-123',
            messagePreview: 'Hello there!',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleMessageWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.SYSTEM,
            title: 'Новое сообщение',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleAchievementUnlockedWebhook', () => {
      it('should handle achievement unlocked webhook', async () => {
        const eventDto: AchievementEventDto = {
          userId: mockUserId,
          eventType: 'achievement.unlocked',
          data: {
            achievementId: 'achievement-123',
            achievementName: 'First Victory',
            achievementDescription: 'Win your first game',
            gameId: 'game-456',
            gameName: 'Test Game',
            points: 100,
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleAchievementUnlockedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.ACHIEVEMENT,
            title: 'Достижение разблокировано!',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleReviewCreatedWebhook', () => {
      it('should handle review created webhook', async () => {
        const eventDto: ReviewEventDto = {
          userId: mockUserId,
          eventType: 'review.created',
          data: {
            reviewId: 'review-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            reviewerName: 'Reviewer User',
            rating: 5,
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleReviewCreatedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.SYSTEM,
            title: 'Новый отзыв на игру',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleGameUpdatedWebhook', () => {
      it('should handle game updated webhook', async () => {
        const eventDto: GameCatalogEventDto = {
          userId: mockUserId,
          eventType: 'game.updated',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            updateType: 'content',
            version: '1.2.0',
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleGameUpdatedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.GAME_UPDATE,
            title: 'Обновление игры: Test Game',
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          })
        );
      });
    });

    describe('handleGameSaleStartedWebhook', () => {
      it('should handle game sale started webhook', async () => {
        const eventDto: GameCatalogEventDto = {
          userId: mockUserId,
          eventType: 'game.sale_started',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            saleDiscount: 50,
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleGameSaleStartedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.GAME_UPDATE,
            title: 'Скидка на игру: Test Game',
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          })
        );
      });
    });

    describe('handleLibraryGameAddedWebhook', () => {
      it('should handle library game added webhook', async () => {
        const eventDto: LibraryEventDto = {
          userId: mockUserId,
          eventType: 'library.game_added',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            addedAt: mockDate.toISOString(),
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleLibraryGameAddedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.SYSTEM,
            title: 'Игра добавлена в библиотеку',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });

    describe('handleLibraryGameRemovedWebhook', () => {
      it('should handle library game removed webhook', async () => {
        const eventDto: LibraryEventDto = {
          userId: mockUserId,
          eventType: 'library.game_removed',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            removedAt: mockDate.toISOString(),
          },
        };

        mockNotificationService.createNotification.mockResolvedValue(mockNotificationDto);

        const result = await controller.handleLibraryGameRemovedWebhook(eventDto);

        expect(result).toEqual({ status: 'accepted' });
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.SYSTEM,
            title: 'Игра удалена из библиотеки',
            channels: [NotificationChannel.IN_APP],
          })
        );
      });
    });
  });

  describe('Statistics and Bulk Operations', () => {
    const mockRequest: AuthenticatedRequest = {
      user: { id: mockUserId, isAdmin: false },
    } as AuthenticatedRequest;

    describe('getUserStats', () => {
      it('should return user notification statistics', async () => {
        const mockStats = {
          total: 10,
          unread: 3,
          byType: {
            [NotificationType.PURCHASE]: 5,
            [NotificationType.ACHIEVEMENT]: 2,
            [NotificationType.FRIEND_REQUEST]: 1,
            [NotificationType.GAME_UPDATE]: 1,
            [NotificationType.SYSTEM]: 1,
          },
        };

        mockNotificationService.getUserNotificationStats.mockResolvedValue(mockStats);

        const result = await controller.getUserStats(mockRequest, mockUserId);

        expect(result).toEqual(mockStats);
        expect(notificationService.getUserNotificationStats).toHaveBeenCalledWith(mockUserId);
      });

      it('should throw ForbiddenException when user tries to access other user stats', async () => {
        const otherUserId = 'other-user-id';

        await expect(
          controller.getUserStats(mockRequest, otherUserId)
        ).rejects.toThrow(ForbiddenException);

        expect(notificationService.getUserNotificationStats).not.toHaveBeenCalled();
      });
    });

    describe('createBulkNotifications (Admin only)', () => {
      const adminRequest: AuthenticatedRequest = {
        user: { id: mockAdminUserId, isAdmin: true },
      } as AuthenticatedRequest;

      it('should create bulk notifications when called by admin', async () => {
        const bulkDto = {
          userIds: ['user1', 'user2', 'user3'],
          notification: {
            type: NotificationType.SYSTEM,
            title: 'System Maintenance',
            message: 'Scheduled maintenance tonight',
          },
        };

        const mockResult = { created: 3, skipped: 0 };
        mockNotificationService.createBulkNotifications.mockResolvedValue(mockResult);

        const result = await controller.createBulkNotifications(adminRequest, bulkDto);

        expect(result).toEqual(mockResult);
        expect(notificationService.createBulkNotifications).toHaveBeenCalledWith(
          bulkDto.userIds,
          bulkDto.notification
        );
      });
    });
  });

  describe('Cache Management (Admin only)', () => {
    const adminRequest: AuthenticatedRequest = {
      user: { id: mockAdminUserId, isAdmin: true },
    } as AuthenticatedRequest;

    describe('getCacheStats', () => {
      it('should return cache statistics when called by admin', async () => {
        const mockStats = {
          redisConnected: true,
          cacheKeys: ['settings:user1', 'settings:user2'],
        };

        mockNotificationService.getCacheStats.mockResolvedValue(mockStats);

        const result = await controller.getCacheStats(adminRequest);

        expect(result).toEqual(mockStats);
        expect(notificationService.getCacheStats).toHaveBeenCalled();
      });
    });

    describe('clearUserCache', () => {
      it('should clear user cache when user clears own cache', async () => {
        const mockRequest: AuthenticatedRequest = {
          user: { id: mockUserId, isAdmin: false },
        } as AuthenticatedRequest;

        mockNotificationService.clearSettingsCache.mockResolvedValue(undefined);

        await controller.clearUserCache(mockRequest, mockUserId);

        expect(notificationService.clearSettingsCache).toHaveBeenCalledWith(mockUserId);
      });

      it('should allow admin to clear any user cache', async () => {
        mockNotificationService.clearSettingsCache.mockResolvedValue(undefined);

        await controller.clearUserCache(adminRequest, mockUserId);

        expect(notificationService.clearSettingsCache).toHaveBeenCalledWith(mockUserId);
      });

      it('should throw ForbiddenException when user tries to clear other user cache', async () => {
        const mockRequest: AuthenticatedRequest = {
          user: { id: mockUserId, isAdmin: false },
        } as AuthenticatedRequest;
        const otherUserId = 'other-user-id';

        await expect(
          controller.clearUserCache(mockRequest, otherUserId)
        ).rejects.toThrow(ForbiddenException);

        expect(notificationService.clearSettingsCache).not.toHaveBeenCalled();
      });
    });
  });
});