import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SecurityAlertSeverity } from '../../../common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../../../common/enums/security-alert-type.enum';

export class GetAlertsQueryDto {
  @ApiPropertyOptional({ enum: SecurityAlertType })
  @IsOptional()
  @IsEnum(SecurityAlertType)
  type?: SecurityAlertType;

  @ApiPropertyOptional({ enum: SecurityAlertSeverity })
  @IsOptional()
  @IsEnum(SecurityAlertSeverity)
  severity?: SecurityAlertSeverity;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;
}
