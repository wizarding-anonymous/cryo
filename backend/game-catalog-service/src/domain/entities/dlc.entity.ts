import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Game } from './game.entity';

@Entity('dlcs')
export class Dlc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, game => game.dlcs, { onDelete: 'CASCADE' })
  baseGame: Game;

  @Column()
  @Index()
  baseGameId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'date', nullable: true })
  releaseDate: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
