import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OwnershipResponseDto {
  @ApiProperty({
    description: 'Whether the user owns the game',
    example: true,
  })
  owns!: boolean;

  @ApiPropertyOptional({
    description: 'Purchase date (if owned)',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  purchaseDate?: Date;

  @ApiPropertyOptional({
    description: 'Purchase price (if owned)',
    example: 59.99,
  })
  purchasePrice?: number;

  @ApiPropertyOptional({
    description: 'Currency code (if owned)',
    example: 'RUB',
  })
  currency?: string;
}
