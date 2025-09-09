import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SuggestQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prefix: string;
}
