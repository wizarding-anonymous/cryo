import { IsString, IsNotEmpty, MaxLength, IsUUID, IsNumber, Min, IsObject, IsOptional } from 'class-validator';

export class CreateEditionDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsObject()
  @IsOptional()
  content?: any;
}
