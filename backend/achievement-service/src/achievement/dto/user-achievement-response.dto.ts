import { ApiProperty } from '@nestjs/swagger';
import { AchievementResponseDto } from './achievement-response.dto';

export class UserAchievementResponseDto {
  @ApiProperty({
    description: 'ID записи о достижении пользователя',
    example: '123e4567-e89b-12d3-a456-426614174003',
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
    description: 'Дата разблокировки достижения',
    example: '2024-01-15T10:30:00.000Z',
  })
  unlockedAt!: Date;
}
