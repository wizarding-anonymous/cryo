import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({
    description: 'Field that failed validation',
    example: 'page',
  })
  field: string;

  @ApiProperty({
    description: 'Validation error message',
    example: 'Page must be at least 1',
  })
  message: string;

  @ApiProperty({
    description: 'Value that failed validation',
    example: 0,
  })
  value: any;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Error code',
    example: 'VALIDATION_ERROR',
  })
  code: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2023-01-15T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that caused the error',
    example: '/api/games',
  })
  path: string;

  @ApiProperty({
    description: 'Detailed validation errors',
    type: [ValidationErrorDto],
    required: false,
  })
  details?: ValidationErrorDto[];
}