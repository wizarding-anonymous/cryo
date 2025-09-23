import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Note: This is a simplified DTO. A real-world scenario would have
// different DTOs for each provider and more complex validation.
export class PaymentWebhookDto {
  @ApiProperty({
    description: "The external ID of the payment from the provider's system.",
    example: 'ext_payment_123456789',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({
    description: 'The status of the payment from the provider.',
    example: 'success',
  })
  @IsString()
  @IsNotEmpty()
  status: string; // e.g., 'success', 'failure' - this would be specific to each provider

  @ApiProperty({
    description: 'The amount paid, for verification.',
    example: 1999.99,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description: 'The currency of the payment. Only RUB is supported in MVP.',
    example: 'RUB',
    default: 'RUB',
  })
  @IsOptional()
  @IsString()
  @IsIn(['RUB'])
  currency?: string = 'RUB';

  @ApiProperty({
    description: "A signature to verify the webhook's authenticity.",
    example: 'sha256_signature_hash',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
