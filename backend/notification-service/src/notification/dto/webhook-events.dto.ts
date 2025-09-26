import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// Base webhook event DTO
export class BaseWebhookEventDto {
  @IsString()
  @ApiProperty({
    description: 'Event type identifier',
    example: 'payment.completed',
  })
  eventType!: string;

  @IsUUID()
  @ApiProperty({
    description: 'User ID associated with the event',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  userId!: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({
    description: 'Additional event data',
    required: false,
  })
  data?: Record<string, any>;
}

// Payment Service webhook events
export class PaymentEventDto extends BaseWebhookEventDto {
  @IsEnum(['payment.completed', 'payment.failed', 'payment.refunded'])
  @ApiProperty({
    description: 'Payment event type',
    enum: ['payment.completed', 'payment.failed', 'payment.refunded'],
    example: 'payment.completed',
  })
  eventType!: 'payment.completed' | 'payment.failed' | 'payment.refunded';

  @IsObject()
  @ApiProperty({
    description: 'Payment event data',
    example: {
      paymentId: 'payment-uuid',
      gameId: 'game-uuid',
      gameName: 'Cyberpunk 2077',
      amount: 1999.99,
      currency: 'RUB',
      errorMessage: 'Insufficient funds',
    },
  })
  data!: {
    paymentId: string;
    gameId: string;
    gameName: string;
    amount: number;
    currency: string;
    errorMessage?: string; // For failed payments
  };
}

// Social Service webhook events
export class SocialEventDto extends BaseWebhookEventDto {
  @IsEnum(['friend.request', 'friend.accepted', 'message.received'])
  @ApiProperty({
    description: 'Social event type',
    enum: ['friend.request', 'friend.accepted', 'message.received'],
    example: 'friend.request',
  })
  eventType!: 'friend.request' | 'friend.accepted' | 'message.received';

  @IsObject()
  @ApiProperty({
    description: 'Social event data',
    example: {
      fromUserId: 'sender-uuid',
      fromUserName: 'John Doe',
      messageId: 'message-uuid',
      messagePreview: 'Hello there!',
    },
  })
  data!: {
    fromUserId: string;
    fromUserName: string;
    messageId?: string;
    messagePreview?: string; // For message notifications
  };
}

// Achievement Service webhook events
export class AchievementEventDto extends BaseWebhookEventDto {
  @IsEnum(['achievement.unlocked'])
  @ApiProperty({
    description: 'Achievement event type',
    enum: ['achievement.unlocked'],
    example: 'achievement.unlocked',
  })
  eventType!: 'achievement.unlocked';

  @IsObject()
  @ApiProperty({
    description: 'Achievement event data',
    example: {
      achievementId: 'achievement-uuid',
      achievementName: 'First Victory',
      achievementDescription: 'Win your first game',
      gameId: 'game-uuid',
      gameName: 'Chess Master',
      points: 100,
    },
  })
  data!: {
    achievementId: string;
    achievementName: string;
    achievementDescription: string;
    gameId: string;
    gameName: string;
    points?: number; // Achievement points
  };
}

// Review Service webhook events
export class ReviewEventDto extends BaseWebhookEventDto {
  @IsEnum(['review.created', 'review.replied'])
  @ApiProperty({
    description: 'Review event type',
    enum: ['review.created', 'review.replied'],
    example: 'review.created',
  })
  eventType!: 'review.created' | 'review.replied';

  @IsObject()
  @ApiProperty({
    description: 'Review event data',
    example: {
      reviewId: 'review-uuid',
      gameId: 'game-uuid',
      gameName: 'Cyberpunk 2077',
      reviewerName: 'Jane Smith',
      rating: 5,
    },
  })
  data!: {
    reviewId: string;
    gameId: string;
    gameName: string;
    reviewerName: string;
    rating: number;
  };
}

// Game Catalog Service webhook events
export class GameCatalogEventDto extends BaseWebhookEventDto {
  @IsEnum(['game.updated', 'game.sale_started'])
  @ApiProperty({
    description: 'Game catalog event type',
    enum: ['game.updated', 'game.sale_started'],
    example: 'game.updated',
  })
  eventType!: 'game.updated' | 'game.sale_started';

  @IsObject()
  @ApiProperty({
    description: 'Game catalog event data',
    example: {
      gameId: 'game-uuid',
      gameName: 'Cyberpunk 2077',
      updateType: 'patch',
      version: '2.1.0',
      saleDiscount: 50,
    },
  })
  data!: {
    gameId: string;
    gameName: string;
    updateType?: string;
    version?: string;
    saleDiscount?: number;
  };
}

// Library Service webhook events
export class LibraryEventDto extends BaseWebhookEventDto {
  @IsEnum(['library.game_added', 'library.game_removed'])
  @ApiProperty({
    description: 'Library event type',
    enum: ['library.game_added', 'library.game_removed'],
    example: 'library.game_added',
  })
  eventType!: 'library.game_added' | 'library.game_removed';

  @IsObject()
  @ApiProperty({
    description: 'Library event data',
    example: {
      gameId: 'game-uuid',
      gameName: 'Cyberpunk 2077',
      addedAt: '2024-01-01T10:00:00Z',
    },
  })
  data!: {
    gameId: string;
    gameName: string;
    addedAt?: string;
    removedAt?: string;
  };
}
