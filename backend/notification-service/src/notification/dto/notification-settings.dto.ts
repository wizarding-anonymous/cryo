import { ApiProperty } from '@nestjs/swagger';

export class NotificationSettingsDto {
  @ApiProperty({ description: 'The unique ID of the settings object' })
  id!: string;

  @ApiProperty({ description: 'The ID of the user who owns these settings' })
  userId!: string;

  @ApiProperty({ description: 'Global toggle for in-app notifications' })
  inAppNotifications!: boolean;

  @ApiProperty({ description: 'Global toggle for email notifications' })
  emailNotifications!: boolean;

  @ApiProperty({ description: 'Toggle for friend request notifications' })
  friendRequests!: boolean;

  @ApiProperty({ description: 'Toggle for game update notifications' })
  gameUpdates!: boolean;

  @ApiProperty({ description: 'Toggle for achievement notifications' })
  achievements!: boolean;

  @ApiProperty({ description: 'Toggle for purchase notifications' })
  purchases!: boolean;

  @ApiProperty({ description: 'Toggle for system notifications' })
  systemNotifications!: boolean;

  @ApiProperty({ description: 'The date the settings were last updated' })
  updatedAt!: Date;
}
