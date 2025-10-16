import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

/**
 * DTO для биллинговой информации пользователя
 * Используется Payment Service для обработки платежей
 */
export class InternalBillingInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'User full name for billing',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email for billing notifications',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User language preference for billing communications',
    example: 'en',
    nullable: true,
  })
  language: string | null;

  @ApiProperty({
    description: 'User timezone for billing timestamps',
    example: 'UTC',
    nullable: true,
  })
  timezone: string | null;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Account creation date for billing history',
    example: '2023-01-01T10:00:00Z',
  })
  createdAt: Date;
}

/**
 * DTO для обновления биллинговой информации
 */
export class UpdateBillingInfoDto {
  @ApiProperty({
    description: 'Updated full name for billing',
    example: 'John Smith',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Updated email for billing notifications',
    example: 'john.smith@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    description: 'Updated language preference',
    example: 'es',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({
    description: 'Updated timezone',
    example: 'America/New_York',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
