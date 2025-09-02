import { IsOptional, IsUUID, IsNumber, Min, Max, IsDateString, IsBoolean } from 'class-validator';

export class UpdatePromotionDto {
  @IsUUID()
  @IsOptional()
  gameId?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  percentage?: number;

  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
