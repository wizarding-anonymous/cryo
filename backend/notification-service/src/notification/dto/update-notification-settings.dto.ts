import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable all in-app notifications',
    required: false,
    example: true,
  })
  inAppNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable all email notifications',
    required: false,
    example: false,
  })
  emailNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable friend request notifications',
    required: false,
  })
  friendRequests?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable game update notifications',
    required: false,
  })
  gameUpdates?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable achievement notifications',
    required: false,
  })
  achievements?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable purchase notifications',
    required: false,
  })
  purchases?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Enable or disable system notifications',
    required: false,
  })
  systemNotifications?: boolean;
}
