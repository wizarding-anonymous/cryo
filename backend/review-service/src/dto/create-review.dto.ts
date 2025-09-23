import { IsString, IsNotEmpty, Length, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID игры для отзыва',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    description: 'Текст отзыва',
    example: 'Отличная игра! Очень понравилась графика и геймплей.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @Length(10, 1000, {
    message: 'Текст отзыва должен содержать от 10 до 1000 символов'
  })
  text: string;

  @ApiProperty({
    description: 'Рейтинг игры от 1 до 5 звезд',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt({
    message: 'Рейтинг должен быть целым числом'
  })
  @Min(1, {
    message: 'Минимальный рейтинг - 1 звезда'
  })
  @Max(5, {
    message: 'Максимальный рейтинг - 5 звезд'
  })
  rating: number;
}