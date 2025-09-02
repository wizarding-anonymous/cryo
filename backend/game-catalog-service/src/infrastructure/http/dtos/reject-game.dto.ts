import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectGameDto {
  @ApiProperty({ description: 'The reason for rejecting the game submission.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
