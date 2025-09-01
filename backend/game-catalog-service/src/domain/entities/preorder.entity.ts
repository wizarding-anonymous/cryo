import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Game } from './game.entity';
import { PreorderTier } from './preorder-tier.entity';

@Entity('preorders')
export class Preorder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn()
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @Column({ type: 'timestamp with time zone' })
  startDate: Date;

  @Column({ type: 'timestamp with time zone' })
  releaseDate: Date;

  @Column({ default: true })
  isAvailable: boolean;

  @OneToMany(() => PreorderTier, tier => tier.preorder, { cascade: true })
  tiers: PreorderTier[];
}
