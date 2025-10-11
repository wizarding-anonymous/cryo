import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('security_events')
@Index(['userId', 'createdAt'])
@Index(['type', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
@Index(['processed'])
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ 
    type: 'enum',
    enum: [
      'registration',
      'login',
      'logout',
      'failed_login',
      'password_change',
      'token_refresh',
      'suspicious_activity',
      'account_locked',
      'session_expired',
      'all_sessions_invalidated',
      'security_session_invalidation',
      'brute_force_attack'
    ]
  })
  @Index()
  type: 'registration' | 'login' | 'logout' | 'failed_login' | 'password_change' | 'token_refresh' | 'suspicious_activity' | 'account_locked' | 'session_expired' | 'all_sessions_invalidated' | 'security_session_invalidation' | 'brute_force_attack';

  @Column({ type: 'varchar', length: 45 })
  @Index()
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  @Index()
  processed: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  createdAt: Date;
}