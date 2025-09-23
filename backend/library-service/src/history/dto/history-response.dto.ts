import { ApiProperty } from '@nestjs/swagger';
import { PurchaseHistoryDto } from './purchase-history.dto';
import { PaginationMetaDto } from '../../common/dto';

export class HistoryResponseDto {
  @ApiProperty({
    description: 'List of purchase history entries',
    type: [PurchaseHistoryDto],
  })
  purchases!: PurchaseHistoryDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationMetaDto,
  })
  pagination!: PaginationMetaDto;
}
