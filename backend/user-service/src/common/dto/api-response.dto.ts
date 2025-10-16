import { ApiProperty } from '@nestjs/swagger';

/**
 * Метаданные пагинации
 */
export class PaginationMeta {
  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevious: boolean;

  @ApiProperty({
    description: 'Cursor for next page (cursor-based pagination)',
    nullable: true,
    example: 'eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTA6MDA6MDBaIn0=',
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Cursor for previous page (cursor-based pagination)',
    nullable: true,
    example: null,
  })
  previousCursor: string | null;

  constructor(
    total: number,
    page: number,
    limit: number,
    hasNext: boolean = false,
    hasPrevious: boolean = false,
    nextCursor: string | null = null,
    previousCursor: string | null = null,
  ) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = hasNext;
    this.hasPrevious = hasPrevious;
    this.nextCursor = nextCursor;
    this.previousCursor = previousCursor;
  }
}

/**
 * Стандартный формат ответа API для всех endpoints
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
    nullable: true,
  })
  data: T | null;

  @ApiProperty({
    description: 'Error message if request failed',
    nullable: true,
    example: null,
  })
  error: string | null;

  @ApiProperty({
    description: 'Additional metadata',
    nullable: true,
    example: null,
  })
  meta?: Record<string, any> | null;

  @ApiProperty({
    description: 'Request timestamp',
    example: '2023-12-01T10:00:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req_123456789',
  })
  correlationId: string;

  constructor(
    data: T | null,
    success: boolean = true,
    error: string | null = null,
    meta?: Record<string, any> | null,
    correlationId?: string,
  ) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
    this.correlationId =
      correlationId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static success<T>(
    data: T,
    meta?: Record<string, any>,
    correlationId?: string,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(data, true, null, meta, correlationId);
  }

  static error<T = null>(
    error: string,
    correlationId?: string,
    data: T | null = null,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(data, false, error, null, correlationId);
  }
}

/**
 * Стандартный формат для пагинированных ответов
 */
export class PaginatedResponseDto<T = any> {
  @ApiProperty({
    description: 'Array of items',
    isArray: true,
  })
  items: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      total: 100,
      page: 1,
      limit: 20,
      totalPages: 5,
      hasNext: true,
      hasPrevious: false,
      nextCursor:
        'eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTA6MDA6MDBaIn0=',
      previousCursor: null,
    },
  })
  pagination: PaginationMeta;

  constructor(items: T[], pagination: PaginationMeta) {
    this.items = items;
    this.pagination = pagination;
  }
}
