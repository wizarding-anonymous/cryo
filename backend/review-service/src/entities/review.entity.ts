import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('reviews')
@Index(['gameId'])
@Index(['userId'])
@Index(['gameId', 'userId'], { unique: true })
export class Review {
  @ApiProperty({
    description: 'Unique identifier for the review',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'ID of the user who created the review',
    example: 'user-123',
  })
  @Column()
  userId: string;

  @ApiProperty({
    description: 'ID of the game being reviewed',
    example: 'game-456',
  })
  @Column()
  gameId: string;

  @ApiProperty({
    description: 'Review text content',
    example: 'This is an amazing game with great graphics and gameplay!',
  })
  @Column('text')
  text: string;

  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Column('int', { 
    transformer: {
      to: (value: number) => value,
      from: (value: number) => value,
    }
  })
  rating: number;

  @ApiProperty({
    description: 'Date when the review was created',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the review was last updated',
    example: '2024-01-16T14:20:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}