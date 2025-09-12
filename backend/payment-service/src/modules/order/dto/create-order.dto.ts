import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the game being purchased.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    description: 'The name of the game being purchased.',
    example: 'Cyber-RPG 2077',
  })
  @IsString()
  @IsNotEmpty()
  gameName: string;

  @ApiProperty({
    description: 'The price of the game.',
    example: 1999.99,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
