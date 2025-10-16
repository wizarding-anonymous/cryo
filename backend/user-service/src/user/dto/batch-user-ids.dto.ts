import { IsArray, IsUUID, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BatchProcessingOptionsDto } from './batch-processing-options.dto';

export class BatchUserIdsDto {
  @ApiProperty({
    description: 'Array of user IDs',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

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
