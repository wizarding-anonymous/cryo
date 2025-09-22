import { IsString, IsNotEmpty, IsUUID, IsNumber, IsPositive, Min, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the game being purchased.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  gameId: string;

  @ApiProperty({
    description: 'The name of the game being purchased.',
    example: 'Cyberpunk 2077',
  })
  @IsString()
  @IsNotEmpty()
  gameName: string;

  @ApiProperty({
    description: 'The amount to be paid for the game in RUB.',
    example: 1999.99,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description: 'The currency for the payment. Only RUB is supported in MVP.',
    example: 'RUB',
    default: 'RUB',
  })
  @IsOptional()
  @IsString()
  @IsIn(['RUB'])
  currency?: string = 'RUB';
}
