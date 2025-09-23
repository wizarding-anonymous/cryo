import { IsEnum, IsIP, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { SecurityAlertType } from '../../common/enums/security-alert-type.enum';
import { SecurityAlertSeverity } from '../../common/enums/security-alert-severity.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSecurityAlertDto {
  @ApiProperty({ enum: SecurityAlertType })
  @IsEnum(SecurityAlertType)
  type!: SecurityAlertType;

  @ApiProperty({ enum: SecurityAlertSeverity })
  @IsEnum(SecurityAlertSeverity)
  severity!: SecurityAlertSeverity;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIP()
  ip?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
