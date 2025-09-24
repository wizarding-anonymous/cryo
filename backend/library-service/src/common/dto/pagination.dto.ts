import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PaginationMetaDto {
  @ApiPropertyOptional({
    description: 'Total number of items',
    example: 150,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiPropertyOptional({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
