import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsArray, ArrayMinSize, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class FranchiseGameDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsInt()
  @Min(1)
  orderInSeries: number;
}

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
  @ValidateNested({ each: true })
  @Type(() => FranchiseGameDto)
  games?: FranchiseGameDto[];
}
