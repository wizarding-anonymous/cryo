import {
  IsUUID,
  IsNumber,
  Min,
  IsString,
  Length,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddGameToLibraryDto {
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
    description: 'Purchase ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsUUID()
  purchaseId!: string;

  @ApiProperty({
    description: 'Purchase price',
    minimum: 0,
    example: 59.99,
  })
  @IsNumber()
  @Min(0)
  purchasePrice!: number;

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
    description: 'Purchase date',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  purchaseDate!: string;
}
