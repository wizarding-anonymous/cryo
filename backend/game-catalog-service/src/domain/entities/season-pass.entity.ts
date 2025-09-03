import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { Game } from './game.entity';
import { SeasonPassDlc } from './season-pass-dlc.entity';

@Entity('season_passes')
export class SeasonPass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Game)
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @OneToMany(() => SeasonPassDlc, seasonPassDlc => seasonPassDlc.seasonPass, { cascade: true })
  dlcsInPass: SeasonPassDlc[];
}
