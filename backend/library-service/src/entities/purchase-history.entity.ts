import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PurchaseStatus {
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

@Entity('purchase_history')
export class PurchaseHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column('uuid')
  gameId!: string;

  @Column('uuid')
  orderId!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column('varchar', { length: 3 })
  currency!: string;

  @Column('enum', { enum: PurchaseStatus })
  status!: PurchaseStatus;

  @Column('varchar', { length: 100 })
  paymentMethod!: string;

  @Column('jsonb', { nullable: true })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
