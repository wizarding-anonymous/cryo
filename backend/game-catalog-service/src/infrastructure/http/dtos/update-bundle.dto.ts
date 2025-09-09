import { IsString, MaxLength, IsOptional, IsUUID, IsNumber, Min, IsArray, ArrayMinSize } from 'class-validator';

export class UpdateBundleDto {
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

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  gameIds?: string[];
}
