import { IsString, IsNotEmpty, IsUUID, IsDateString, IsBoolean, IsOptional, IsArray, ValidateNested, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePreorderTierDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsString()
    @IsOptional()
    description?: string;
}

export class CreatePreorderDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsDateString()
  startDate: Date;

  @IsDateString()
  releaseDate: Date;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePreorderTierDto)
  @IsOptional()
  tiers?: CreatePreorderTierDto[];
}
