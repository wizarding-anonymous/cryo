import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ 
    description: 'Error type or code',
    example: 'VALIDATION_ERROR'
  })
  @IsString()
  error!: string;

  @ApiProperty({ 
    description: 'Human-readable error message',
    example: 'Invalid request parameters'
  })
  @IsString()
  message!: string;

  @ApiProperty({ 
    description: 'HTTP status code',
    example: 400,
    minimum: 100,
    maximum: 599
  })
  @IsInt()
  @Min(100)
  statusCode!: number;

  @ApiProperty({ 
    description: 'Timestamp when the error occurred',
    example: '2024-01-15T10:30:00.000Z'
  })
  @IsString()
  timestamp!: string;

  @ApiProperty({ 
    description: 'Request path that caused the error',
    example: '/api/users/profile'
  })
  @IsString()
  path!: string;

  @ApiPropertyOptional({ 
    description: 'Service that generated the error',
    example: 'user-service'
  })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ 
    description: 'Unique request identifier for tracing',
    example: 'req-123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: 'Additional error details' })
  @IsOptional()
  details?: any;
}