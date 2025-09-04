import { ApiProperty } from '@nestjs/swagger';

export class GameAnalyticsDto {
  @ApiProperty({ example: 'c1b9a7a9-1b1a-4b1a-8b1a-1b1a1b1a1b1a', description: 'Game ID' })
  gameId: string;

  @ApiProperty({ example: 'Super Awesome Game', description: 'Game Title' })
  title: string;

  @ApiProperty({ example: 150000, description: 'Total number of views' })
  viewsCount: number;

  @ApiProperty({ example: 2500, description: 'Total number of sales' })
  salesCount: number;

  @ApiProperty({ example: 12000, description: 'Total number of downloads' })
  downloadCount: number;

  @ApiProperty({ example: 4.5, description: 'Average user rating' })
  averageRating: number;

  @ApiProperty({ example: 850, description: 'Total number of reviews' })
  reviewsCount: number;
}
