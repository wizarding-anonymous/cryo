import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, Unique } from 'typeorm';
import { Game } from './game.entity';

@Entity('game_translations')
@Unique(['gameId', 'languageCode'])
export class GameTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  game: Game;

  @Column()
  @Index()
  gameId: string;

  @Column({ type: 'varchar', length: 10 })
  @Index()
  languageCode: string; // e.g., 'en', 'ru'

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;
}
