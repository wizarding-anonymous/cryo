import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  PaymentEventDto,
  SocialEventDto,
  AchievementEventDto,
  ReviewEventDto,
  GameCatalogEventDto,
  LibraryEventDto,
} from './webhook-events.dto';

describe('Webhook Event DTOs', () => {
  describe('PaymentEventDto', () => {
    it('should validate payment completed event', async () => {
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
      expect(dto.eventType).toBe('payment.completed');
      expect(dto.data.amount).toBe(59.99);
    });

    it('should validate payment failed event', async () => {
      const dto = plainToClass(PaymentEventDto, {
        eventType: 'payment.failed',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          paymentId: 'payment-123',
          amount: 59.99,
          currency: 'RUB',
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
          errorMessage: 'Insufficient funds',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.data.errorMessage).toBe('Insufficient funds');
    });

    it('should pass validation even with negative amount (no nested validation)', async () => {
      const dto = plainToClass(PaymentEventDto, {
        eventType: 'payment.completed',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          paymentId: 'payment-123',
          amount: -10, // Negative amount passes (no nested validation)
          currency: 'RUB',
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('SocialEventDto', () => {
    it('should validate friend request event', async () => {
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
      expect(dto.eventType).toBe('friend.request');
    });

    it('should validate message received event', async () => {
      const dto = plainToClass(SocialEventDto, {
        eventType: 'message.received',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          fromUserId: 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
          fromUserName: 'TestUser',
          messageId: 'message-123',
          messagePreview: 'Hello there!',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.data.messagePreview).toBe('Hello there!');
    });

    it('should pass validation even with invalid fromUserId (no nested validation)', async () => {
      const dto = plainToClass(SocialEventDto, {
        eventType: 'friend.request',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          fromUserId: 'invalid-uuid',
          fromUserName: 'TestUser',
          requestId: 'request-123',
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('AchievementEventDto', () => {
    it('should validate achievement unlocked event', async () => {
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
      expect(dto.data.points).toBe(100);
    });

    it('should pass validation even with negative points (no nested validation)', async () => {
      const dto = plainToClass(AchievementEventDto, {
        eventType: 'achievement.unlocked',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          achievementId: 'achievement-123',
          achievementName: 'First Victory',
          gameId: 'game-456',
          gameName: 'Test Game',
          points: -10, // Negative points pass (no nested validation)
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('ReviewEventDto', () => {
    it('should validate review created event', async () => {
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
      expect(dto.data.rating).toBe(5);
    });

    it('should pass validation even with invalid rating (no nested validation)', async () => {
      const dto = plainToClass(ReviewEventDto, {
        eventType: 'review.created',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          reviewId: 'review-123',
          gameId: 'game-456',
          gameName: 'Test Game',
          rating: 6, // Rating passes (no nested validation)
          reviewerName: 'TestUser',
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('GameCatalogEventDto', () => {
    it('should validate game updated event', async () => {
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
      expect(dto.data.version).toBe('2.1.0');
    });

    it('should validate game sale event', async () => {
      const dto = plainToClass(GameCatalogEventDto, {
        eventType: 'game.sale_started',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'The Witcher 3',
          saleDiscount: 50,
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.data.saleDiscount).toBe(50);
    });

    it('should pass validation even with invalid discount percentage (no nested validation)', async () => {
      const dto = plainToClass(GameCatalogEventDto, {
        eventType: 'game.sale_started',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'The Witcher 3',
          saleDiscount: 101, // Discount passes (no nested validation)
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('LibraryEventDto', () => {
    it('should validate game added event', async () => {
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
      expect(dto.data.addedAt).toBe('2024-01-01T10:00:00Z');
    });

    it('should validate game removed event', async () => {
      const dto = plainToClass(LibraryEventDto, {
        eventType: 'library.game_removed',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'Old Game',
          removedAt: '2024-01-01T10:00:00Z',
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.data.removedAt).toBe('2024-01-01T10:00:00Z');
    });

    it('should pass validation even with invalid date format (no nested validation)', async () => {
      const dto = plainToClass(LibraryEventDto, {
        eventType: 'library.game_added',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        data: {
          gameId: 'game-456',
          gameName: 'Red Dead Redemption 2',
          addedAt: 'invalid-date',
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
