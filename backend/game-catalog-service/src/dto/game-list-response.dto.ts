import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { GameResponseDto } from './game-response.dto';

export class GameListResponseDto {
  @ApiProperty({
    description: 'Array of games',
    type: [GameResponseDto],
  })
  @Expose()
  @Type(() => GameResponseDto)
  games: GameResponseDto[];

  @ApiProperty({
    description: 'Total number of games matching the criteria',
    example: 150,
  })
  @Expose()
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @Expose()
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  @Expose()
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15,
  })
  @Expose()
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  @Expose()
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  @Expose()
  hasPrevious: boolean;

  constructor(
    games: GameResponseDto[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.games = games;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrevious = page > 1;
  }
}