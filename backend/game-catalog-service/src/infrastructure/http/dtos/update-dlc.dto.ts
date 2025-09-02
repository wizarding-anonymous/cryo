import { IsString, MaxLength, IsOptional, IsNumber, Min, IsDateString } from 'class-validator';

export class UpdateDlcDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsDateString()
  @IsOptional()
  releaseDate?: Date;
}
