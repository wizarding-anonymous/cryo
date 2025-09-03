import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Franchise } from './franchise.entity';
import { Game } from './game.entity';

@Entity('franchise_games')
export class FranchiseGame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Franchise, franchise => franchise.gamesInFranchise)
  franchise: Franchise;

  @ManyToOne(() => Game, game => game.franchises)
  game: Game;

  @Column()
  franchiseId: string;

  @Column()
  gameId: string;

  @Column({ type: 'int' })
  orderInSeries: number;
}
