import { ApiProperty } from '@nestjs/swagger';
import { AchievementResponseDto } from './achievement-response.dto';

export class UserProgressResponseDto {
  @ApiProperty({
    description: 'ID записи о прогрессе пользователя',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  id!: string;

  @ApiProperty({
    description: 'ID пользователя',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'ID достижения',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  achievementId!: string;

  @ApiProperty({
    description: 'Информация о достижении',
    type: AchievementResponseDto,
  })
  achievement!: AchievementResponseDto;

  @ApiProperty({
    description: 'Текущее значение прогресса',
    example: 3,
  })
  currentValue!: number;

  @ApiProperty({
    description: 'Целевое значение для получения достижения',
    example: 5,
  })
  targetValue!: number;

  @ApiProperty({
    description: 'Процент выполнения достижения (вычисляемое поле)',
    example: 60,
    minimum: 0,
    maximum: 100,
  })
  progressPercentage!: number;

  @ApiProperty({
    description: 'Дата последнего обновления прогресса',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: Date;

  constructor(partial: Partial<UserProgressResponseDto>) {
    Object.assign(this, partial);
    // Calculate progress percentage
    this.progressPercentage =
      this.targetValue > 0
        ? Math.min(Math.round((this.currentValue / this.targetValue) * 100), 100)
        : 0;
  }
}
