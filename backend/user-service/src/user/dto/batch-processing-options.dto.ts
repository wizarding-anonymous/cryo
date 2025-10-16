import { IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchProcessingOptionsDto {
  @ApiProperty({
    description: 'Size of each processing chunk',
    minimum: 1,
    maximum: 1000,
    default: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  chunkSize?: number;

  @ApiProperty({
    description: 'Maximum number of concurrent operations',
    minimum: 1,
    maximum: 10,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxConcurrency?: number;

  @ApiProperty({
    description: 'Whether to continue processing on individual item errors',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  continueOnError?: boolean;
}
