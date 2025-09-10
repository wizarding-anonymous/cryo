import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Game } from './game.entity';

export enum RoadmapStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('game_roadmaps')
export class GameRoadmap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn()
  game: Game;

  @Column('uuid')
  @Index()
  gameId: string;

  @Column({ type: 'varchar', length: 255 })
  milestoneName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  targetDate: Date;

  @Column({
    type: 'enum',
    enum: RoadmapStatus,
    default: RoadmapStatus.PLANNED,
  })
  @Index()
  status: RoadmapStatus;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}