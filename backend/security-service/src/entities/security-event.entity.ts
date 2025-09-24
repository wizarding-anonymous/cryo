import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SecurityEventType } from '../common/enums/security-event-type.enum';

@Entity('security_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('security_event_type_idx')
  @Column({
    type: 'enum',
    enum: SecurityEventType,
  })
  type!: SecurityEventType;

  @Index('security_event_user_idx')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Index('security_event_ip_idx')
  @Column({ type: 'varchar', length: 45 })
  ip!: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb' })
  data!: Record<string, unknown>;

  @Column({ name: 'risk_score', type: 'float', default: 0 })
  riskScore!: number;

  @Index('security_event_created_at_idx')
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
