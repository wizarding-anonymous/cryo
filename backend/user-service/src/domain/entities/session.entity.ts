import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'jsonb', name: 'device_info' })
  deviceInfo: object;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 255, name: 'access_token_hash' })
  accessTokenHash: string;

  @Column({ type: 'varchar', length: 255, name: 'refresh_token_hash' })
  refreshTokenHash: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'last_activity_at' })
  lastActivityAt: Date;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'terminated_reason' })
  terminatedReason?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'terminated_at' })
  terminatedAt?: Date;
}
