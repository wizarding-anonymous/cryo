import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code for programmatic handling',
    example: 'VALIDATION_ERROR',
  })
  error!: string;

  @ApiPropertyOptional({
    description: 'Correlation ID for request tracking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  correlationId?: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the error',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Request path that caused the error',
    example: '/api/library/my',
  })
  path?: string;

  @ApiPropertyOptional({
    description: 'Detailed validation errors',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string', example: 'gameId' },
        message: { type: 'string', example: 'gameId must be a UUID' },
      },
    },
  })
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: 400;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'VALIDATION_ERROR',
  })
  error!: 'VALIDATION_ERROR';

  @ApiProperty({
    description: 'Detailed validation errors',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string', example: 'gameId' },
        message: { type: 'string', example: 'gameId must be a UUID' },
      },
    },
  })
  details!: Array<{
    field: string;
    message: string;
  }>;
}

export class UnauthorizedErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 401,
  })
  statusCode!: 401;

  @ApiProperty({
    description: 'Error message',
    example: 'Unauthorized',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'UNAUTHORIZED',
  })
  error!: 'UNAUTHORIZED';
}

export class ForbiddenErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 403,
  })
  statusCode!: 403;

  @ApiProperty({
    description: 'Error message',
    example: 'Access denied',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'FORBIDDEN',
  })
  error!: 'FORBIDDEN';
}

export class NotFoundErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode!: 404;

  @ApiProperty({
    description: 'Error message',
    example: 'Resource not found',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'NOT_FOUND',
  })
  error!: 'NOT_FOUND';
}

export class ConflictErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 409,
  })
  statusCode!: 409;

  @ApiProperty({
    description: 'Error message',
    example: 'Resource already exists',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'CONFLICT',
  })
  error!: 'CONFLICT';
}

export class InternalServerErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 500,
  })
  statusCode!: 500;

  @ApiProperty({
    description: 'Error message',
    example: 'Internal server error',
  })
  message!: string;

  @ApiProperty({
    description: 'Error code',
    example: 'INTERNAL_SERVER_ERROR',
  })
  error!: 'INTERNAL_SERVER_ERROR';

  @ApiPropertyOptional({
    description: 'Correlation ID for request tracking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  correlationId?: string;
}