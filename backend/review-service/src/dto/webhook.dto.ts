import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AchievementWebhookDto {
  @ApiProperty({
    description: 'ID пользователя, получившего достижение',
    example: 'user-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Тип достижения',
    example: 'FIRST_REVIEW',
    enum: ['FIRST_REVIEW', 'REVIEW_MASTER', 'CRITIC'],
  })
  @IsString()
  @IsNotEmpty()
  achievementType: string;

  @ApiProperty({
    description: 'Временная метка получения достижения',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Дополнительные метаданные достижения',
    example: { source: 'review-service', reviewId: 'review-456' },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class NotificationWebhookDto {
  @ApiProperty({
    description: 'ID отзыва, для которого отправлено уведомление',
    example: 'review-456',
  })
  @IsString()
  @IsNotEmpty()
  reviewId: string;

  @ApiProperty({
    description: 'Тип уведомления',
    example: 'NEW_REVIEW',
    enum: ['NEW_REVIEW', 'REVIEW_UPDATED', 'REVIEW_DELETED', 'REVIEW_LIKED'],
  })
  @IsString()
  @IsNotEmpty()
  notificationType: string;

  @ApiProperty({
    description: 'Статус отправки уведомления',
    example: 'sent',
    enum: ['sent', 'failed', 'pending'],
  })
  @IsEnum(['sent', 'failed', 'pending'])
  status: 'sent' | 'failed' | 'pending';

  @ApiProperty({
    description: 'Временная метка обработки уведомления',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Сообщение об ошибке (если статус failed)',
    example: 'User not found',
    required: false,
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({
    description: 'Дополнительные данные уведомления',
    example: { recipientId: 'user-789', channel: 'email' },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class GameCatalogWebhookDto {
  @ApiProperty({
    description: 'ID игры, для которой обновлен рейтинг',
    example: 'game-123',
  })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    description: 'Статус синхронизации рейтинга',
    example: 'success',
    enum: ['success', 'failed', 'partial'],
  })
  @IsEnum(['success', 'failed', 'partial'])
  syncStatus: 'success' | 'failed' | 'partial';

  @ApiProperty({
    description: 'Средний рейтинг игры в каталоге',
    example: 4.25,
  })
  @IsNumber()
  averageRating: number;

  @ApiProperty({
    description: 'Общее количество отзывов в каталоге',
    example: 150,
  })
  @IsNumber()
  totalReviews: number;

  @ApiProperty({
    description: 'Временная метка синхронизации',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Сообщение об ошибке синхронизации (если статус failed)',
    example: 'Database connection timeout',
    required: false,
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({
    description: 'Дополнительные данные синхронизации',
    example: { previousRating: 4.1, ratingDelta: 0.15 },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class LibraryWebhookDto {
  @ApiProperty({
    description: 'ID пользователя',
    example: 'user-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'ID игры',
    example: 'game-456',
  })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    description: 'Тип события в библиотеке',
    example: 'GAME_PURCHASED',
    enum: ['GAME_PURCHASED', 'GAME_REMOVED', 'GAME_REFUNDED'],
  })
  @IsEnum(['GAME_PURCHASED', 'GAME_REMOVED', 'GAME_REFUNDED'])
  eventType: 'GAME_PURCHASED' | 'GAME_REMOVED' | 'GAME_REFUNDED';

  @ApiProperty({
    description: 'Временная метка события',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Дополнительные данные события',
    example: { purchasePrice: 29.99, currency: 'RUB' },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}