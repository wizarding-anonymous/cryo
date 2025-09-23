import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { PurchaseStatus, HistorySortBy, SortOrder } from '../../common/enums';

export class HistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: HistorySortBy,
    default: HistorySortBy.CREATED_AT,
    example: HistorySortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(HistorySortBy)
  sortBy?: HistorySortBy = HistorySortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
  @ApiPropertyOptional({
    description: 'Filter by purchase status',
    enum: PurchaseStatus,
    example: PurchaseStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @ApiPropertyOptional({
    description: 'Filter purchases from this date',
    format: 'date-time',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter purchases to this date',
    format: 'date-time',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
