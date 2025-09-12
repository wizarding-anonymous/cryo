import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'The ID of the order to create a payment for.',
    example: 'b1c2d3e4-f5g6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'The payment provider to use.',
    enum: PaymentProvider,
    example: PaymentProvider.SBERBANK,
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
