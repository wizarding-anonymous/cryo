import { IsBoolean, IsIP, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IPStatusResult {
  @ApiProperty({ description: 'IP address' })
  @IsIP()
  ip: string;

  @ApiProperty()
  @IsBoolean()
  isBlocked: boolean;

  @ApiPropertyOptional({ description: 'ISO timestamp until which IP is blocked' })
  @IsOptional()
  @IsString()
  blockedUntil?: string;
}
