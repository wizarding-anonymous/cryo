import { IsEnum, IsIP, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { SecurityEventType } from '../../common/enums/security-event-type.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportSecurityEventDto {
  @ApiProperty({ enum: SecurityEventType })
  @IsEnum(SecurityEventType)
  type!: SecurityEventType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Client IP address' })
  @IsIP()
  ip!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;
}
