import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsUUID,
  IsNumber,
  Length,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SortBy {
  PURCHASE_DATE = 'purchaseDate',
  TITLE = 'title',
  DEVELOPER = 'developer',
  PRICE = 'price',
}

export class LibraryQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort by field', enum: SortBy, default: SortBy.PURCHASE_DATE })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.PURCHASE_DATE;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class SearchLibraryDto extends LibraryQueryDto {
  @ApiProperty({ description: 'Search query string', minLength: 2, maxLength: 100, example: 'Cyber' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  query!: string;
}

export class AddGameToLibraryDto {
  @ApiProperty({ description: 'User ID', format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Game ID', format: 'uuid' })
  @IsUUID()
  gameId!: string;

  @ApiProperty({ description: 'Order ID from payment service', format: 'uuid' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ description: 'Purchase ID from payment service', format: 'uuid' })
  @IsUUID()
  purchaseId!: string;

  @ApiProperty({ description: 'Price of the game at time of purchase', example: 49.99 })
  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD', maxLength: 3, minLength: 3 })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ description: 'Date of purchase in ISO 8601 format' })
  @IsDateString()
  purchaseDate!: string;
}
