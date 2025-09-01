import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessActivityDto {
  @ApiProperty({ description: 'Activity type' })
  @IsString()
  activity: string;

  @ApiProperty({ description: 'Activity metadata', required: false })
  @IsOptional()
  metadata?: any;
}

export class AdminUpdateReputationDto {
  @ApiProperty({ description: 'User ID to update' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Reputation change (can be negative)' })
  @IsNumber()
  change: number;

  @ApiProperty({ description: 'Reason for the change' })
  @IsString()
  reason: string;
}