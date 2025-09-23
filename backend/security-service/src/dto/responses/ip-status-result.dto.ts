import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IPStatusResult {
  @ApiProperty()
  @IsBoolean()
  isBlocked!: boolean;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @IsDate()
  blockedUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
