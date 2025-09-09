import { IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateTagDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;
}
