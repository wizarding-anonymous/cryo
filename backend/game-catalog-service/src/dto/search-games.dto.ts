import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { GetGamesDto } from './get-games.dto';

export class SearchGamesDto extends GetGamesDto {
  @ApiProperty({
    description: 'The search query string to find games by title',
    minLength: 1,
    maxLength: 255,
    required: false,
    example: 'cyberpunk',
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(255, { message: 'Search query cannot exceed 255 characters' })
  @Transform(
    ({ value }) => (typeof value === 'string' ? value.trim() || undefined : value) as string | undefined,
  )
  q?: string;

  @ApiProperty({
    description: 'Search type - determines how the search is performed',
    enum: ['title', 'description', 'all'],
    required: false,
    default: 'title',
    example: 'title',
  })
  @IsOptional()
  @IsString()
  @IsIn(['title', 'description', 'all'], {
    message: 'Search type must be one of: title, description, all',
  })
  searchType?: 'title' | 'description' | 'all' = 'title';

  @ApiProperty({
    description: 'Minimum price filter for search results',
    required: false,
    example: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter for search results',
    required: false,
    example: 5000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  maxPrice?: number;
}
