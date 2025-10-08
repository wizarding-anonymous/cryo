import { IsUUID, IsNumber, IsPositive, IsIn } from 'class-validator';

export class AddGameToLibraryDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  gameId: string;

  @IsUUID()
  orderId: string;

  @IsNumber()
  @IsPositive()
  purchasePrice: number;

  @IsIn(['RUB'])
  currency: string;
}
