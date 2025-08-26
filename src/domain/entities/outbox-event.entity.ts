import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: object;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'integer', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'timestamp', name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // e.g., 'pending', 'processed', 'failed'
}
