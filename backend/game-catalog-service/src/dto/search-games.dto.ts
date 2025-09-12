import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GetGamesDto } from './get-games.dto';

export class SearchGamesDto extends GetGamesDto {
  @ApiProperty({
    description: 'The search query string.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;
}
