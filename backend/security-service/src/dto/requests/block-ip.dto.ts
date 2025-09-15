import { IsIP, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockIPDto {
  @ApiProperty({ description: 'IP address to block' })
  @IsIP()
  ip: string;

  @ApiProperty()
  @IsString()
  reason: string;

  // Duration in seconds
  @ApiProperty({ description: 'Duration in seconds', minimum: 1 })
  @IsInt()
  @Min(1)
  duration: number;

  @ApiPropertyOptional({ description: 'Admin user id' })
  @IsOptional()
  @IsString()
  blockedBy?: string; // admin id
}
