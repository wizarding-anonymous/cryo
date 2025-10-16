import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO для batch запроса профилей пользователей
 * Используется Game Catalog Service для получения множественных профилей
 */
export class InternalBatchProfilesRequestDto {
  @ApiProperty({
    description: 'Array of user IDs to get profiles for',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '456e7890-e89b-12d3-a456-426614174001',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Include privacy settings in response',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  includePrivacySettings?: boolean;

  @ApiProperty({
    description: 'Include user preferences in response',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  includePreferences?: boolean;

  @ApiProperty({
    description: 'Chunk size for processing large batches',
    minimum: 1,
    maximum: 100,
    required: false,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  chunkSize?: number;
}
