import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  IsIn,
  IsDateString,
  IsBoolean,
} from 'class-validator';

/**
 * Стандартные параметры пагинации
 */
export class PaginationQueryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Cursor for cursor-based pagination (base64 encoded)',
    required: false,
    example: 'eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTA6MDA6MDBaIn0=',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'name', 'email', 'lastLoginAt'],
    default: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'name', 'email', 'lastLoginAt'])
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Параметры фильтрации пользователей
 */
export class UserFilterDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by user name (partial match)',
    required: false,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Filter by email (partial match)',
    required: false,
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Filter by creation date from (ISO string)',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiProperty({
    description: 'Filter by creation date to (ISO string)',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiProperty({
    description: 'Filter by last login date from (ISO string)',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginFrom?: string;

  @ApiProperty({
    description: 'Filter by last login date to (ISO string)',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginTo?: string;

  @ApiProperty({
    description: 'Filter by language preference',
    required: false,
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    description: 'Filter by timezone preference',
    required: false,
    example: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    description: 'Include deleted users (soft deleted)',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeDeleted?: boolean = false;
}

/**
 * Cursor для cursor-based пагинации
 */
export interface CursorData {
  id: string;
  createdAt: string;
  [key: string]: any;
}

/**
 * Утилиты для работы с курсорами
 */
export class CursorUtils {
  /**
   * Кодирует данные курсора в base64 строку
   */
  static encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Декодирует курсор из base64 строки
   */
  static decodeCursor(cursor: string): CursorData | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded) as CursorData;
    } catch {
      return null;
    }
  }

  /**
   * Создает курсор из объекта пользователя
   */
  static createUserCursor(user: Record<string, any>, sortBy: string = 'createdAt'): string {
    const cursorData: CursorData = {
      id: user.id as string,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt as string,
    };

    // Добавляем поле сортировки если оно отличается от createdAt
    if (sortBy !== 'createdAt' && user[sortBy] !== undefined) {
      const sortValue = user[sortBy];
      cursorData[sortBy] = sortValue instanceof Date 
        ? sortValue.toISOString() 
        : sortValue;
    }

    return this.encodeCursor(cursorData);
  }
}
