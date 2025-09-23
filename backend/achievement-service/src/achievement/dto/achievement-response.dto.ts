import { ApiProperty } from '@nestjs/swagger';
import { AchievementType, type AchievementCondition } from '../entities/achievement.entity';

export class AchievementResponseDto {
  @ApiProperty({
    description: 'ID достижения',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id!: string;

  @ApiProperty({
    description: 'Название достижения',
    example: 'Первая покупка',
  })
  name!: string;

  @ApiProperty({
    description: 'Описание достижения',
    example: 'Поздравляем с первой покупкой игры на платформе!',
  })
  description!: string;

  @ApiProperty({
    description: 'Тип достижения',
    enum: AchievementType,
    example: AchievementType.FIRST_PURCHASE,
  })
  type!: AchievementType;

  @ApiProperty({
    description: 'URL иконки достижения',
    example: 'https://example.com/icons/first-purchase.png',
    nullable: true,
  })
  iconUrl!: string | null;

  @ApiProperty({
    description: 'Количество очков за достижение',
    example: 100,
  })
  points!: number;

  @ApiProperty({
    description: 'Условие получения достижения',
    example: { type: 'first_time' },
  })
  condition!: AchievementCondition;

  @ApiProperty({
    description: 'Активно ли достижение',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Дата создания достижения',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Дата последнего обновления достижения',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
}
