import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Game } from './game.entity';

@Entity('game_videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, game => game.videos, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'int', nullable: true })
  duration: number; // in seconds

  @Column({ type: 'varchar', length: 20, default: 'trailer' })
  videoType: 'trailer' | 'gameplay' | 'review';

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
