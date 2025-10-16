import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

/**
 * Оптимизированный DTO для межсервисного взаимодействия
 * Содержит только необходимые поля для других микросервисов
 */
export class InternalUserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2023-12-01T10:00:00Z',
    nullable: true,
  })
  @Expose()
  lastLoginAt: Date | null;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-01-01T10:00:00Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  updatedAt: Date;

  // Исключаем чувствительные данные
  @Exclude()
  password: string;

  @Exclude()
  deletedAt: Date;
}
