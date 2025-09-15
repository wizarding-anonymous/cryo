import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SecurityAlertSeverity } from '../../../common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../../../common/enums/security-alert-type.enum';

export class GetAlertsQueryDto {
  @IsOptional()
  @IsEnum(SecurityAlertType)
  type?: SecurityAlertType;

  @IsOptional()
  @IsEnum(SecurityAlertSeverity)
  severity?: SecurityAlertSeverity;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  resolved?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;
}

