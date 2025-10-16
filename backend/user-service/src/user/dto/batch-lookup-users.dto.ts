import {
  IsArray,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchLookupUsersDto {
  @ApiProperty({
    description: 'Array of user IDs to lookup',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Chunk size for processing',
    minimum: 1,
    maximum: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  chunkSize?: number;
}
