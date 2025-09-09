import { IsString, MaxLength, IsOptional, IsNumber, Min, IsObject } from 'class-validator';

export class UpdateEditionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsObject()
  @IsOptional()
  content?: any;
}
