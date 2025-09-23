import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetStatusDto {
  @ApiPropertyOptional({
    description: 'The game the user is currently playing',
    example: 'Cyberpunk 2077',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentGame?: string;
}
