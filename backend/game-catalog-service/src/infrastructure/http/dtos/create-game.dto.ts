import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, Min, IsBoolean, IsDateString, MaxLength, MinLength } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  shortDescription?: string;

  @IsUUID()
  @IsNotEmpty()
  developerId: string;

  @IsUUID()
  @IsOptional()
  publisherId?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  isFree: boolean;

  @IsDateString()
  @IsOptional()
  releaseDate?: Date;
}
