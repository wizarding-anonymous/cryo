import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class CreateFranchiseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  gameIds?: string[];
}
