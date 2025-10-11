import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('login_attempts')
@Index(['email', 'attemptedAt'])
@Index(['userId', 'attemptedAt'])
@Index(['ipAddress', 'attemptedAt'])
@Index(['successful', 'attemptedAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  email: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'varchar', length: 45 })
  @Index()
  ipAddress: string;

  @Column({ type: 'text' })
  userAgent: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  successful: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  attemptedAt: Date;
}