import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('game_ratings')
export class GameRating {
  @ApiProperty({
    description: 'ID of the game',
    example: 'game-456',
  })
  @PrimaryColumn()
  gameId: string;

  @ApiProperty({
    description: 'Average rating calculated from all reviews',
    example: 4.25,
    minimum: 0,
    maximum: 5,
  })
  @Column('decimal', { precision: 3, scale: 2 })
  averageRating: number;

  @ApiProperty({
    description: 'Total number of reviews for this game',
    example: 42,
  })
  @Column('int')
  totalReviews: number;

  @ApiProperty({
    description: 'Date when the rating was last updated',
    example: '2024-01-16T14:20:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}