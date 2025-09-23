import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { HistoryQueryDto } from './history-query.dto';

export class SearchHistoryDto extends HistoryQueryDto {
  @ApiProperty({
    description: 'Search query string for game titles',
    minLength: 2,
    maxLength: 100,
    example: 'cyberpunk',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  query!: string;
}
