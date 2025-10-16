import {
  IsUUID,
  IsOptional,
  IsString,
  IsEmail,
  IsDate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BatchUpdateDataDto {
  @ApiProperty({ description: 'User name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'User email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Last login timestamp', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastLoginAt?: Date;
}

export class BatchUpdateUserDto {
  @ApiProperty({ description: 'User ID to update' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Data to update', type: BatchUpdateDataDto })
  @ValidateNested()
  @Type(() => BatchUpdateDataDto)
  data: BatchUpdateDataDto;
}
