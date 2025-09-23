import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseStatus } from '../../common/enums';
import { GameDetailsDto } from '../../library/dto';

export class PurchaseHistoryDto {
  @ApiProperty({
    description: 'Purchase history entry ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174005',
  })
  id!: string;

  @ApiProperty({
    description: 'Game ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  gameId!: string;

  @ApiProperty({
    description: 'Order ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  orderId!: string;

  @ApiProperty({
    description: 'Purchase amount',
    example: 59.99,
  })
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  currency!: string;

  @ApiProperty({
    description: 'Purchase status',
    enum: PurchaseStatus,
    example: PurchaseStatus.COMPLETED,
  })
  status!: PurchaseStatus;

  @ApiProperty({
    description: 'Payment method used',
    example: 'credit_card',
  })
  paymentMethod!: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    example: { transactionId: 'tx_123456', gateway: 'stripe' },
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Purchase creation date',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update date',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Game details (enriched from catalog service)',
    type: GameDetailsDto,
  })
  gameDetails?: GameDetailsDto;
}
