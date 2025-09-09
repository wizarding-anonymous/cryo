import { IsEnum, IsOptional, IsInt, Min, MaxLength, IsUrl, IsBoolean, IsString } from 'class-validator';
import { DemoType } from '../../../domain/entities/demo.entity';

export class UpdateDemoDto {
  @IsEnum(DemoType)
  @IsOptional()
  type?: DemoType;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimitMinutes?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  contentDescription?: string;

  @IsUrl()
  @IsOptional()
  downloadUrl?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
