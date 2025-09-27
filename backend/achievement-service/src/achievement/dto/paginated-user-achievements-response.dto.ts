import { ApiProperty } from '@nestjs/swagger';
import { UserAchievementResponseDto } from './user-achievement-response.dto';

export class PaginatedUserAchievementsResponseDto {
  @ApiProperty({
    description: 'Список достижений пользователя',
    type: [UserAchievementResponseDto],
  })
  achievements: UserAchievementResponseDto[] = [];

  @ApiProperty({
    description: 'Общее количество достижений',
    example: 50,
  })
  total: number = 0;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  page: number = 1;

  @ApiProperty({
    description: 'Количество элементов на странице',
    example: 20,
  })
  limit: number = 20;

  @ApiProperty({
    description: 'Общее количество страниц',
    example: 3,
  })
  totalPages: number = 0;
}
