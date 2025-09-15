import { IsEnum, IsIP, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { SecurityEventType } from '../../common/enums/security-event-type.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportSecurityEventDto {
  @ApiProperty({ enum: SecurityEventType })
  @IsEnum(SecurityEventType)
  type: SecurityEventType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Client IP address' })
  @IsOptional()
  @IsIP()
  ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  riskScore?: number;
}
