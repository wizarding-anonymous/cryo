import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SecurityAlertSeverity } from '../common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../common/enums/security-alert-type.enum';

@Entity('security_alerts')
export class SecurityAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: SecurityAlertType,
    default: SecurityAlertType.SUSPICIOUS_ACTIVITY,
  })
  type!: SecurityAlertType;

  @Column({
    type: 'enum',
    enum: SecurityAlertSeverity,
    default: SecurityAlertSeverity.LOW,
  })
  severity!: SecurityAlertSeverity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Index('security_alert_resolved_idx')
  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
