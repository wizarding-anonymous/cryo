import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
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
} from './index';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
} from '../../common/enums';

describe('DTO Validation', () => {
  describe('CreateNotificationDto', () => {
    it('should validate a valid CreateNotificationDto', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: NotificationType.PURCHASE,
        title: 'Test Title',
        message: 'Test Message',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP],
        metadata: { key: 'value' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid userId', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        userId: 'invalid-uuid',
        type: NotificationType.PURCHASE,
        title: 'Test Title',
        message: 'Test Message',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(CreateNotificationDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const properties = errors.map((error) => error.property);
      expect(properties).toContain('userId');
      expect(properties).toContain('type');
      expect(properties).toContain('title');
      expect(properties).toContain('message');
    });

    it('should fail validation with title too long', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: NotificationType.PURCHASE,
        title: 'a'.repeat(201), // Max length is 200
        message: 'Test Message',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('title');
    });

    it('should fail validation with message too long', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: NotificationType.PURCHASE,
        title: 'Test Title',
        message: 'a'.repeat(1001), // Max length is 1000
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('message');
    });

    it('should fail validation with invalid enum values', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'invalid_type',
        title: 'Test Title',
        message: 'Test Message',
        priority: 'invalid_priority',
        channels: ['invalid_channel'],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const properties = errors.map((error) => error.property);
      expect(properties).toContain('type');
      expect(properties).toContain('priority');
      expect(properties).toContain('channels');
    });
  });

  describe('GetNotificationsDto', () => {
    it('should validate a valid GetNotificationsDto', async () => {
      const dto = plainToClass(GetNotificationsDto, {
        limit: 20,
        offset: 0,
        type: NotificationType.PURCHASE,
        isRead: false,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', async () => {
      const dto = plainToClass(GetNotificationsDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(20);
      expect(dto.offset).toBe(0);
    });

    it('should fail validation with invalid limit', async () => {
      const dto = plainToClass(GetNotificationsDto, {
        limit: 101, // Max is 100
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should fail validation with negative offset', async () => {
      const dto = plainToClass(GetNotificationsDto, {
        offset: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('offset');
    });
  });

  describe('UpdateNotificationSettingsDto', () => {
    it('should validate a valid UpdateNotificationSettingsDto', async () => {
      const dto = plainToClass(UpdateNotificationSettingsDto, {
        inAppNotifications: true,
        emailNotifications: false,
        friendRequests: true,
        gameUpdates: false,
        achievements: true,
        purchases: false,
        systemNotifications: true,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with partial updates', async () => {
      const dto = plainToClass(UpdateNotificationSettingsDto, {
        emailNotifications: false,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with non-boolean values', async () => {
      const dto = plainToClass(UpdateNotificationSettingsDto, {
        inAppNotifications: 'true', // Should be boolean
        emailNotifications: 1, // Should be boolean
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PaymentEventDto', () => {
    it('should validate a valid PaymentEventDto', async () => {
      const dto = plainToClass(PaymentEventDto, {
        eventType: 'payment.completed',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          paymentId: 'payment-123',
          amount: 59.99,
          currency: 'RUB',
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const dto = plainToClass(PaymentEventDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const properties = errors.map((error) => error.property);
      expect(properties).toContain('eventType');
      expect(properties).toContain('userId');
      // data field is optional in base class, so not required
    });
  });

  describe('SocialEventDto', () => {
    it('should validate a valid SocialEventDto', async () => {
      const dto = plainToClass(SocialEventDto, {
        eventType: 'friend.request',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          fromUserId: 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
          fromUserName: 'TestUser',
          requestId: 'request-123',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('AchievementEventDto', () => {
    it('should validate a valid AchievementEventDto', async () => {
      const dto = plainToClass(AchievementEventDto, {
        eventType: 'achievement.unlocked',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          achievementId: 'achievement-123',
          achievementName: 'First Victory',
          gameId: 'game-456',
          gameName: 'Test Game',
          points: 100,
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('ReviewEventDto', () => {
    it('should validate a valid ReviewEventDto', async () => {
      const dto = plainToClass(ReviewEventDto, {
        eventType: 'review.created',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          reviewId: 'review-123',
          gameId: 'game-456',
          gameName: 'Test Game',
          rating: 5,
          reviewerName: 'TestUser',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('GameCatalogEventDto', () => {
    it('should validate a valid GameCatalogEventDto', async () => {
      const dto = plainToClass(GameCatalogEventDto, {
        eventType: 'game.updated',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
          updateType: 'patch',
          version: '2.1.0',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('LibraryEventDto', () => {
    it('should validate a valid LibraryEventDto', async () => {
      const dto = plainToClass(LibraryEventDto, {
        eventType: 'library.game_added',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'Red Dead Redemption 2',
          addedAt: '2024-01-01T10:00:00Z',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
