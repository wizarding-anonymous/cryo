import { IsIP, IsInt, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlockIPDto {
  @ApiProperty({ description: 'IP address to block' })
  @IsIP()
  ip!: string;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty({ description: 'Duration in minutes', minimum: 1 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;
}
