import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('game_ratings')
export class GameRating {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  gameId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  totalReviews: number;

  @UpdateDateColumn()
  updatedAt: Date;
}