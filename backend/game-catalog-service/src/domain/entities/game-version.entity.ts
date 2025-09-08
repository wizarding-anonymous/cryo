import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('game_versions')
export class GameVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'game_id' })
  gameId: string;

  @ManyToOne(() => Game, game => game.versions)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @Column({ type: 'bigint', nullable: true, name: 'file_size' })
  fileSize: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'download_url' })
  downloadUrl: string;

  @Column({ type: 'boolean', default: false, name: 'is_current' })
  isCurrent: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}
