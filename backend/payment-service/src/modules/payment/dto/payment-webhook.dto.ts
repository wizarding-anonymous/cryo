import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Note: This is a simplified DTO. A real-world scenario would have
// different DTOs for each provider and more complex validation.
export class PaymentWebhookDto {
  @ApiProperty({ description: "The external ID of the payment from the provider's system." })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({ description: "The status of the payment from the provider." })
  @IsString()
  @IsNotEmpty()
  status: string; // e.g., 'success', 'failure' - this would be specific to each provider

  @ApiProperty({ description: "The amount paid, for verification." })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: "A signature to verify the webhook's authenticity." })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
