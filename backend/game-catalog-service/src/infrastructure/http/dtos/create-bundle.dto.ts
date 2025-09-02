import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsNumber, Min, IsArray, ArrayMinSize } from 'class-validator';

export class CreateBundleDto {
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

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  gameIds: string[];
}
