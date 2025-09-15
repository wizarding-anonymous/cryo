import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ip_blocks')
export class IPBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ip_block_ip_idx')
  @Column({ type: 'varchar', length: 45, nullable: false })
  ip: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  reason: string | null;

  @Column({ name: 'blocked_until', type: 'timestamp with time zone', nullable: true })
  blockedUntil: Date | null;

  @Column({ name: 'blocked_by', type: 'uuid', nullable: true })
  blockedBy: string | null;

  @Index('ip_block_active_idx')
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}

