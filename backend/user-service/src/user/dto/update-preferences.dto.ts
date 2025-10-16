import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NotificationSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Enable email notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({
    example: true,
    description: 'Enable push notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiProperty({
    example: false,
    description: 'Enable SMS notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

class GameSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Enable automatic game downloads',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoDownload?: boolean;

  @ApiProperty({
    example: true,
    description: 'Enable cloud save synchronization',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  cloudSave?: boolean;

  @ApiProperty({
    example: true,
    description: 'Enable achievement notifications',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  achievementNotifications?: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({
    example: 'en',
    description: 'User interface language',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    example: 'UTC',
    description: 'User timezone',
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    example: 'dark',
    description: 'UI theme preference',
    enum: ['light', 'dark', 'auto'],
    required: false,
  })
  @IsOptional()
  @IsIn(['light', 'dark', 'auto'])
  theme?: 'light' | 'dark' | 'auto';

  @ApiProperty({
    description: 'Notification preferences',
    type: NotificationSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @ApiProperty({
    description: 'Game-related preferences',
    type: GameSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GameSettingsDto)
  gameSettings?: GameSettingsDto;
}
