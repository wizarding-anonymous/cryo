import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Game } from './game.entity';

@Entity('bundles')
export class Bundle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @ManyToMany(() => Game)
    @JoinTable({
        name: 'bundle_games',
        joinColumn: { name: 'bundle_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'game_id', referencedColumnName: 'id' },
    })
    games: Game[];
}
