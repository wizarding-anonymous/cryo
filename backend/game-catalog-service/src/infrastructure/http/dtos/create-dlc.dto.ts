import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsNumber, Min, IsDateString } from 'class-validator';

export class CreateDlcDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsDateString()
  @IsOptional()
  releaseDate?: Date;

  @IsUUID()
  @IsNotEmpty()
  baseGameId: string;
}
