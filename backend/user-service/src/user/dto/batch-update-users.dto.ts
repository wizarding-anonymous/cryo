import { IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BatchUpdateUserDto } from './batch-update-user.dto';
import { BatchProcessingOptionsDto } from './batch-processing-options.dto';

export class BatchUpdateUsersDto {
  @ApiProperty({
    description: 'Array of user updates',
    type: [BatchUpdateUserDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchUpdateUserDto)
  updates: BatchUpdateUserDto[];

  @ApiProperty({
    description: 'Processing options for batch operation',
    type: BatchProcessingOptionsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BatchProcessingOptionsDto)
  options?: BatchProcessingOptionsDto;
}
