import { IsOptional, IsString, Length, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Updated review text content',
    example: 'This is an updated review with new thoughts about the game!',
    minLength: 10,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(10, 1000, {
    message: 'Review text must be between 10 and 1000 characters'
  })
  text?: string;

  @ApiPropertyOptional({
    description: 'Updated rating from 1 to 5 stars',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating must be at most 5 stars' })
  rating?: number;
}