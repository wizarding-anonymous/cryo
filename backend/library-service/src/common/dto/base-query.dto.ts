import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';
import { SortBy, SortOrder } from '../enums';

export class BaseQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: SortBy,
    default: SortBy.PURCHASE_DATE,
    example: SortBy.PURCHASE_DATE,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.PURCHASE_DATE;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
