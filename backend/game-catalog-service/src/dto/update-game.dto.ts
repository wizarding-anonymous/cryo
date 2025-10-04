import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateGameDto } from './create-game.dto';

export class UpdateGameDto extends PartialType(CreateGameDto) {
  @ApiProperty({
    description: 'Game title',
    example: 'The Witcher 3: Wild Hunt - Updated',
    required: false,
  })
  title?: string;

  @ApiProperty({
    description: 'Game price in rubles',
    example: 1499.99,
    required: false,
  })
  price?: number;

  @ApiProperty({
    description: 'Game availability status',
    example: false,
    required: false,
  })
  available?: boolean;
}