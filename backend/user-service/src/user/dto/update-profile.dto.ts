import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserPreferences, PrivacySettings } from '../interfaces';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'John Doe Updated',
    description: 'The updated name of the user',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Имя не может быть пустым' })
  @IsString()
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name?: string;

  @ApiProperty({
    example: 'https://example.com/avatars/user-123.jpg',
    description: 'URL of the user avatar',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL должен быть валидным URL' })
  avatarUrl?: string;

  @ApiProperty({
    description: 'User preferences (language, theme, notifications, etc.)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  preferences?: UserPreferences;

  @ApiProperty({
    description: 'Privacy settings (profile visibility, online status, etc.)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  privacySettings?: PrivacySettings;

  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;

  // Note: Password operations are handled by authentication service.
  // User Service only manages user profile data.
}
