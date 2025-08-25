import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  phoneNumber?: string;

  @Column({ type: 'boolean', default: false, name: 'phone_verified' })
  phoneVerified: boolean;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  profile: object;

  @Column({ type: 'jsonb', nullable: false, default: {}, name: 'privacy_settings' })
  privacySettings: object;

  @Column({ type: 'jsonb', nullable: false, default: {}, name: 'notification_settings' })
  notificationSettings: object;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ type: 'jsonb', default: [], name: 'mfa_methods' })
  mfaMethods: object;

  @Column({ type: 'text', array: true, nullable: true, name: 'backup_codes' })
  backupCodes?: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_blocked' })
  isBlocked: boolean;

  @Column({ type: 'text', nullable: true, name: 'block_reason' })
  blockReason?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'block_expires_at' })
  blockExpiresAt?: Date;

  @Column({ type: 'integer', default: 0, name: 'reputation_score' })
  reputationScore: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;
}
