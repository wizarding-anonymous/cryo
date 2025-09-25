import { IsString, IsNotEmpty, Length, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID of the game being reviewed',
    example: 'game-123',
  })
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    description: 'Review text content',
    example: 'This is an amazing game with great graphics and gameplay!',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @Length(10, 1000, {
    message: 'Review text must be between 10 and 1000 characters'
  })
  text: string;

  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating must be at most 5 stars' })
  rating: number;
}