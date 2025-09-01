import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Game } from './game.entity';

@Entity('game_discounts')
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, game => game.discounts, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @Column({ type: 'int' })
  percentage: number;

  @Column({ type: 'timestamp with time zone' })
  startDate: Date;

  @Column({ type: 'timestamp with time zone' })
  endDate: Date;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
