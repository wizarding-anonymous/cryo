import { ApiProperty } from '@nestjs/swagger';
import { Game } from '../entities/game.entity';

export class PurchaseInfoDto {
  @ApiProperty({ description: 'The UUID of the game.' })
  id: string;

  @ApiProperty({ description: 'The title of the game.' })
  title: string;

  @ApiProperty({ description: 'The price of the game.' })
  price: number;

  @ApiProperty({ description: 'The currency of the price.' })
  currency: string;

  @ApiProperty({
    description: 'Indicates if the game is available for purchase.',
  })
  available: boolean;

  constructor(game: Game) {
    this.id = game.id;
    this.title = game.title;
    this.price = Number(game.price); // Cast to number
    this.currency = game.currency;
    this.available = game.available;
  }
}
