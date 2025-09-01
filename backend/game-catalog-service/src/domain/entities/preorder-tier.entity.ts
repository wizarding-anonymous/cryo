import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Preorder } from './preorder.entity';

@Entity('preorder_tiers')
export class PreorderTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Preorder, preorder => preorder.tiers, { onDelete: 'CASCADE' })
  preorder: Preorder;

  @Column()
  @Index()
  preorderId: string;

  @Column({ type: 'varchar', length: 50 })
  name: string; // e.g., Standard, Deluxe, Ultimate

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'jsonb', nullable: true })
  bonuses: any; // Could be an array of strings or objects
}
