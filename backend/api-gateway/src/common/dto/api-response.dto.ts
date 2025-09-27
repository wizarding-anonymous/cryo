import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Стандартный формат успешного ответа API
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Данные ответа',
    example: { id: '123', name: 'Example' },
  })
  data!: T;

  @ApiProperty({
    description: 'Статус ответа',
    example: 'success',
  })
  status!: string;

  @ApiProperty({
    description: 'Временная метка ответа',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Уникальный идентификатор запроса',
    example: 'req-123e4567-e89b-12d3-a456-426614174000',
  })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Время выполнения запроса в миллисекундах',
    example: 150,
  })
  executionTime?: number;
}

/**
 * Формат пагинированного ответа
 */
export class PaginatedResponseDto<T = any> {
  @ApiProperty({
    description: 'Массив данных',
    isArray: true,
  })
  data!: T[];

  @ApiProperty({
    description: 'Общее количество элементов',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Количество элементов на странице',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Общее количество страниц',
    example: 10,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Есть ли следующая страница',
    example: true,
  })
  hasNext!: boolean;

  @ApiProperty({
    description: 'Есть ли предыдущая страница',
    example: false,
  })
  hasPrev!: boolean;
}

/**
 * Примеры ответов для игр
 */
export class GameDto {
  @ApiProperty({
    description: 'Уникальный идентификатор игры',
    example: 'game-123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Название игры',
    example: 'Cyberpunk 2077',
  })
  title!: string;

  @ApiProperty({
    description: 'Описание игры',
    example: 'Футуристическая RPG в мире киберпанка',
  })
  description!: string;

  @ApiProperty({
    description: 'Цена игры в копейках',
    example: 199900,
  })
  price!: number;

  @ApiProperty({
    description: 'Жанры игры',
    example: ['RPG', 'Action', 'Sci-Fi'],
    type: [String],
  })
  genres!: string[];

  @ApiProperty({
    description: 'Рейтинг игры',
    example: 4.5,
    minimum: 0,
    maximum: 5,
  })
  rating!: number;

  @ApiProperty({
    description: 'URL изображения обложки',
    example: 'https://cdn.cryo.ru/games/cyberpunk-2077/cover.jpg',
  })
  coverImage!: string;

  @ApiProperty({
    description: 'Дата релиза',
    example: '2020-12-10T00:00:00.000Z',
  })
  releaseDate!: string;

  @ApiProperty({
    description: 'Разработчик игры',
    example: 'CD Projekt RED',
  })
  developer!: string;

  @ApiProperty({
    description: 'Издатель игры',
    example: 'CD Projekt',
  })
  publisher!: string;
}

/**
 * Примеры ответов для профиля пользователя
 */
export class UserProfileDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'gamer123',
  })
  username!: string;

  @ApiProperty({
    description: 'Отображаемое имя',
    example: 'Игрок 123',
  })
  displayName!: string;

  @ApiProperty({
    description: 'URL аватара пользователя',
    example: 'https://cdn.cryo.ru/avatars/user-123.jpg',
  })
  avatar!: string;

  @ApiProperty({
    description: 'Дата регистрации',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Дата последнего обновления профиля',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Статус пользователя',
    example: 'active',
    enum: ['active', 'inactive', 'banned'],
  })
  status!: string;

  @ApiProperty({
    description: 'Роли пользователя',
    example: ['user'],
    type: [String],
  })
  roles!: string[];
}
