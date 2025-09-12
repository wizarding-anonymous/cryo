import { IsString, IsNotEmpty, IsNumber, IsPositive, IsBoolean, IsUUID, IsIn } from 'class-validator';

export class GamePurchaseInfo {
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsIn(['RUB'])
  currency: string;

  @IsBoolean()
  available: boolean;
}
