import { ApiProperty } from '@nestjs/swagger';
import {
  UserPreferences,
  PrivacySettings,
} from '../interfaces/profile.interfaces';

/**
 * Оптимизированный DTO для профиля пользователя для межсервисного взаимодействия
 * Используется Game Catalog Service и другими сервисами
 */
export class InternalProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatars/user123.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    description: 'User preferences',
    nullable: true,
    example: {
      language: 'en',
      timezone: 'UTC',
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      gameSettings: {
        autoDownload: true,
        cloudSave: true,
        achievementNotifications: true,
      },
    },
  })
  preferences: UserPreferences | null;

  @ApiProperty({
    description: 'Privacy settings',
    nullable: true,
    example: {
      profileVisibility: 'public',
      showOnlineStatus: true,
      showGameActivity: true,
      allowFriendRequests: true,
      showAchievements: true,
    },
  })
  privacySettings: PrivacySettings | null;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2023-12-01T10:00:00Z',
    nullable: true,
  })
  lastLoginAt: Date | null;
}

/**
 * Batch DTO для получения множественных профилей
 */
export class InternalBatchProfilesResponseDto {
  @ApiProperty({
    description: 'Array of user profiles',
    type: [InternalProfileResponseDto],
  })
  profiles: InternalProfileResponseDto[];

  @ApiProperty({
    description: 'Statistics about the batch operation',
    example: {
      requested: 10,
      found: 8,
      missing: 2,
    },
  })
  stats: {
    requested: number;
    found: number;
    missing: number;
  };
}
