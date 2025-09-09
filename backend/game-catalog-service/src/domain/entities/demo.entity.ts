import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
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
    @IsUUID()
    id: string;

    @OneToOne(() => Game, { onDelete: 'CASCADE' })
    @JoinColumn()
    game: Game;

    @Column()
    @Index()
    @IsUUID()
    gameId: string;

    @Column({
        type: 'enum',
        enum: DemoType,
    })
    @IsEnum(DemoType)
    type: DemoType;

    @Column({ type: 'int', nullable: true })
    @IsInt()
    @Min(1)
    @Max(1440) // 24 hours
    @IsOptional()
    timeLimitMinutes?: number;

    @Column({ type: 'text', nullable: true })
    @IsString()
    @IsOptional()
    contentDescription?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    @IsString()
    @IsOptional()
    downloadUrl?: string;

    @Column({ default: true })
    @IsBoolean()
    isAvailable: boolean;

    @Column({ type: 'jsonb', nullable: true })
    @IsObject()
    @IsOptional()
    progress?: Record<string, any>;

    @Column({ type: 'int', default: 0 })
    @IsInt()
    @Min(0)
    conversionCount: number;
}
