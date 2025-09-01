import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Game } from './game.entity';

@Entity('franchises')
export class Franchise {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @ManyToMany(() => Game)
    @JoinTable({
        name: 'franchise_games',
        joinColumn: { name: 'franchise_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'game_id', referencedColumnName: 'id' },
    })
    games: Game[];
}
