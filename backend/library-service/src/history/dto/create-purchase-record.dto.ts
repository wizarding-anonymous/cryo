import {
  IsUUID,
  IsNumber,
  Min,
  IsString,
  Length,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseStatus } from '../../common/enums';

export class CreatePurchaseRecordDto {
  @ApiProperty({
    description: 'User ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Game ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  gameId!: string;

  @ApiProperty({
    description: 'Order ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    description: 'Purchase amount',
    minimum: 0,
    example: 59.99,
  })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    minLength: 3,
    maxLength: 3,
    example: 'RUB',
  })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    description: 'Purchase status',
    enum: PurchaseStatus,
    example: PurchaseStatus.COMPLETED,
  })
  @IsEnum(PurchaseStatus)
  status!: PurchaseStatus;

  @ApiProperty({
    description: 'Payment method used',
    maxLength: 100,
    example: 'credit_card',
  })
  @IsString()
  @MaxLength(100)
  paymentMethod!: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    example: { transactionId: 'tx_123456', gateway: 'stripe' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
