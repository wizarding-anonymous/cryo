import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Error timestamp',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/auth/register',
    description: 'Request path where error occurred',
  })
  path: string;

  @ApiProperty({
    example: 'POST',
    description: 'HTTP method used',
  })
  method: string;

  @ApiProperty({
    example: 'Validation failed',
    description: 'Error message',
  })
  message: string;
}

export class ValidationErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'HTTP status code for validation errors',
  })
  statusCode: 400;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Error timestamp',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/auth/register',
    description: 'Request path where error occurred',
  })
  path: string;

  @ApiProperty({
    example: 'POST',
    description: 'HTTP method used',
  })
  method: string;

  @ApiProperty({
    example: ['Пароль должен содержать минимум 8 символов', 'Email имеет некорректный формат'],
    description: 'Array of validation error messages',
    type: [String],
  })
  message: string[];

  @ApiProperty({
    example: 'Bad Request',
    description: 'Error type',
  })
  error: string;
}

export class ConflictErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: 409,
    description: 'HTTP status code for conflict errors',
  })
  statusCode: 409;

  @ApiProperty({
    example: 'Пользователь с таким email уже существует',
    description: 'Conflict error message',
  })
  message: string;

  @ApiProperty({
    example: 'Conflict',
    description: 'Error type',
  })
  error: string;
}

export class UnauthorizedErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: 401,
    description: 'HTTP status code for unauthorized errors',
  })
  statusCode: 401;

  @ApiProperty({
    example: 'Неверный email или пароль',
    description: 'Unauthorized error message',
  })
  message: string;

  @ApiProperty({
    example: 'Unauthorized',
    description: 'Error type',
  })
  error: string;
}

export class RateLimitErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: 429,
    description: 'HTTP status code for rate limit errors',
  })
  statusCode: 429;

  @ApiProperty({
    example: 'Слишком много попыток аутентификации. Попробуйте снова через несколько минут.',
    description: 'Rate limit error message',
  })
  message: string;

  @ApiProperty({
    example: 'Too Many Requests',
    description: 'Error type',
  })
  error: string;

  @ApiProperty({
    example: 900,
    description: 'Time to wait before next attempt (in seconds)',
    required: false,
  })
  retryAfter?: number;
}

export class NotFoundErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: 404,
    description: 'HTTP status code for not found errors',
  })
  statusCode: 404;

  @ApiProperty({
    example: 'Сессия не найдена или доступ запрещен',
    description: 'Not found error message',
  })
  message: string;

  @ApiProperty({
    example: 'Not Found',
    description: 'Error type',
  })
  error: string;
}

export class ServiceUnavailableErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: 503,
    description: 'HTTP status code for service unavailable errors',
  })
  statusCode: 503;

  @ApiProperty({
    example: 'Сервис временно недоступен. Попробуйте позже.',
    description: 'Service unavailable error message',
  })
  message: string;

  @ApiProperty({
    example: 'Service Unavailable',
    description: 'Error type',
  })
  error: string;

  @ApiProperty({
    example: 'user-service',
    description: 'Name of the unavailable service',
    required: false,
  })
  service?: string;
}