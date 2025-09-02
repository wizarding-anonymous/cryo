import { IsString, IsNotEmpty, IsUUID, IsNumber, Min, Max, IsDateString, IsBoolean, IsOptional } from 'class-validator';

export class CreatePromotionDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  percentage: number;

  @IsDateString()
  startDate: Date;

  @IsDateString()
  endDate: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
