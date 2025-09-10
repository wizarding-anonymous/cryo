import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, Index } from 'typeorm';
import { Game } from './game.entity';

export enum PromotionType {
  SEASONAL = 'seasonal',
  FLASH = 'flash',
  WEEKEND = 'weekend',
  HOLIDAY = 'holiday',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  discountPercentage: number;

  @Column({
    type: 'enum',
    enum: PromotionType,
  })
  @Index()
  type: PromotionType;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  startDate: Date;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  endDate: Date;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToMany(() => Game, game => game.promotions)
  @JoinTable({
    name: 'game_promotions',
    joinColumn: { name: 'promotion_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'game_id', referencedColumnName: 'id' },
  })
  games: Game[];
}