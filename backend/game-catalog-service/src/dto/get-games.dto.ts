import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetGamesDto {
  @ApiProperty({
    description: 'The page number to retrieve (1-based)',
    minimum: 1,
    default: 1,
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page: number = 1;

  @ApiProperty({
    description: 'The number of items to return per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit: number = 10;

  @ApiProperty({
    description: 'Sort field for games',
    enum: ['title', 'price', 'releaseDate', 'createdAt'],
    required: false,
    example: 'title',
  })
  @IsOptional()
  @IsString()
  @IsIn(['title', 'price', 'releaseDate', 'createdAt'], {
    message: 'Sort field must be one of: title, price, releaseDate, createdAt',
  })
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    required: false,
    example: 'ASC',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  @IsIn(['ASC', 'DESC'], {
    message: 'Sort order must be either ASC or DESC',
  })
  sortOrder?: 'ASC' | 'DESC';

  @ApiProperty({
    description: 'Filter by genre',
    required: false,
    example: 'Action RPG',
  })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiProperty({
    description: 'Filter by availability status',
    required: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  available?: boolean;
}
