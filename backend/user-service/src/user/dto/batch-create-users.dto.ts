import { IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { BatchProcessingOptionsDto } from './batch-processing-options.dto';

export class BatchCreateUsersDto {
  @ApiProperty({
    description: 'Array of users to create',
    type: [CreateUserDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserDto)
  users: CreateUserDto[];

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
