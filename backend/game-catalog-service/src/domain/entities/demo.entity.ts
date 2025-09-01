import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { Game } from './game.entity';

export enum DemoType {
    TIME_LIMITED = 'time_limited',
    CONTENT_LIMITED = 'content_limited',
    CLOUD_DEMO = 'cloud_demo',
}

@Entity('demos')
export class Demo {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => Game, { onDelete: 'CASCADE' })
    @JoinColumn()
    game: Game;

    @Column()
    @Index()
    gameId: string;

    @Column({
        type: 'enum',
        enum: DemoType,
    })
    type: DemoType;

    @Column({ nullable: true })
    timeLimitMinutes?: number;

    @Column({ type: 'text', nullable: true })
    contentDescription?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    downloadUrl?: string;

    @Column({ default: true })
    isAvailable: boolean;
}
