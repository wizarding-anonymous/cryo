import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { Game } from './game.entity';

export enum GameLifecycleStatus {
  DRAFT = 'draft',
  IN_DEVELOPMENT = 'in_development',
  ALPHA = 'alpha',
  BETA = 'beta',
  EARLY_ACCESS = 'early_access',
  COMING_SOON = 'coming_soon',
  RELEASED = 'released',
  DISCONTINUED = 'discontinued',
}

@Entity('game_lifecycle_status')
export class GameLifecycleStatusEntity {
  @PrimaryColumn('uuid')
  gameId: string;

  @OneToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn()
  game: Game;

  @Column({
    type: 'enum',
    enum: GameLifecycleStatus,
    default: GameLifecycleStatus.DRAFT,
  })
  @Index()
  status: GameLifecycleStatus;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column('uuid')
  updatedBy: string;
}