import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecurityCheckResult {
  @ApiProperty()
  @IsBoolean()
  allowed: boolean;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  riskScore: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  actions?: string[];
}
