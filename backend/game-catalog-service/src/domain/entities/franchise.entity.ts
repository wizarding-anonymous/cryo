import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { FranchiseGame } from './franchise-game.entity';

@Entity('franchises')
export class Franchise {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @OneToMany(() => FranchiseGame, franchiseGame => franchiseGame.franchise, { cascade: true })
    gamesInFranchise: FranchiseGame[];
}
