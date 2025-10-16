import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @ApiProperty({
    example: 'public',
    description: 'Profile visibility setting',
    enum: ['public', 'friends', 'private'],
    required: false,
  })
  @IsOptional()
  @IsIn(['public', 'friends', 'private'])
  profileVisibility?: 'public' | 'friends' | 'private';

  @ApiProperty({
    example: true,
    description: 'Show online status to other users',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @ApiProperty({
    example: true,
    description: 'Show game activity to other users',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showGameActivity?: boolean;

  @ApiProperty({
    example: true,
    description: 'Allow friend requests from other users',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  allowFriendRequests?: boolean;

  @ApiProperty({
    example: true,
    description: 'Show achievements to other users',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showAchievements?: boolean;
}
