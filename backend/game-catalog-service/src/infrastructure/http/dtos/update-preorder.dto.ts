import { IsOptional, IsDateString, IsBoolean, IsArray, ValidateNested, IsUUID, IsString, IsNotEmpty, MaxLength, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePreorderTierDto {
    @IsUUID()
    @IsOptional()
    id?: string;

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

export class UpdatePreorderDto {
  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @IsDateString()
  @IsOptional()
  releaseDate?: Date;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePreorderTierDto)
  @IsOptional()
  tiers?: UpdatePreorderTierDto[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  tiersToDelete?: string[];
}
