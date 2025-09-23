import { IsOptional, IsString, Length, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Обновленный текст отзыва',
    example: 'Обновленный отзыв: игра стала еще лучше после обновления!',
    minLength: 10,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(10, 1000, {
    message: 'Текст отзыва должен содержать от 10 до 1000 символов'
  })
  text?: string;

  @ApiPropertyOptional({
    description: 'Обновленный рейтинг игры от 1 до 5 звезд',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({
    message: 'Рейтинг должен быть целым числом'
  })
  @Min(1, {
    message: 'Минимальный рейтинг - 1 звезда'
  })
  @Max(5, {
    message: 'Максимальный рейтинг - 5 звезд'
  })
  rating?: number;
}