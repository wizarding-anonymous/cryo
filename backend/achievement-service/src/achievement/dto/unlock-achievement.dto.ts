import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnlockAchievementDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID пользователя',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @IsUUID()
  @ApiProperty({
    description: 'ID достижения',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  achievementId!: string;
}
