import { ApiProperty } from '@nestjs/swagger';
import { PurchaseHistory, PurchaseStatus } from '../entities/purchase-history.entity';

export class PurchaseDetailsDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  gameId!: string;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ enum: PurchaseStatus })
  status!: PurchaseStatus;

  @ApiProperty()
  paymentMethod!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, required: false })
  metadata?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: PurchaseHistory): PurchaseDetailsDto {
    const dto = new PurchaseDetailsDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.gameId = entity.gameId;
    dto.orderId = entity.orderId;
    dto.amount = Number(entity.amount);
    dto.currency = entity.currency;
    dto.status = entity.status;
    dto.paymentMethod = entity.paymentMethod;
    dto.metadata = entity.metadata ?? null;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

class PaginationDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class HistoryResponseDto {
  @ApiProperty({ type: [PurchaseDetailsDto] })
  history!: PurchaseDetailsDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
