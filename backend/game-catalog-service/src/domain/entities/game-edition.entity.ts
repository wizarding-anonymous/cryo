import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, OneToMany } from 'typeorm';
import { DlcEditionCompatibility } from './dlc-edition-compatibility.entity';
import { Game } from './game.entity';

@Entity('game_editions')
export class GameEdition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Game, game => game.editions, { onDelete: 'CASCADE' })
    game: Game;

    @Column()
    @Index()
    gameId: string;

    @Column({ type: 'varchar', length: 100 })
    name: string; // e.g., Standard, Deluxe, Collector's

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @Column({ type: 'jsonb', nullable: true })
    content: any; // Description of what's included

  @OneToMany(() => DlcEditionCompatibility, compatibility => compatibility.edition)
  compatibleDlcs: DlcEditionCompatibility[];
}
