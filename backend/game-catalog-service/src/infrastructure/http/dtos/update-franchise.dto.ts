import { IsString, MaxLength, IsOptional, IsUUID, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateFranchiseGameDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsInt()
  @Min(1)
  orderInSeries: number;
}

export class UpdateFranchiseDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateFranchiseGameDto)
  gamesToUpdate?: UpdateFranchiseGameDto[]; // To add or update games in the series

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  gamesToRemove?: string[]; // To remove games from the series by gameId
}
