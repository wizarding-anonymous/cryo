import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserPreferences, PrivacySettings } from '../interfaces';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: false,
  })
  @Index('user_email_idx', { unique: true })
  email: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  @Exclude() // Exclude password from serialization
  password: string; // This will store the hashed password

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  name: string;

  @Column({
    name: 'last_login_at',
    nullable: true,
  })
  lastLoginAt?: Date;

  @CreateDateColumn({
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    nullable: true,
  })
  deletedAt?: Date;

  // Profile fields
  @Column({
    type: 'varchar',
    length: 500,
    name: 'avatar_url',
    nullable: true,
  })
  avatarUrl?: string;

  // Encrypted sensitive data - stored as encrypted strings in database
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted user preferences data',
  })
  preferences?: UserPreferences;

  @Column({
    type: 'text',
    name: 'privacy_settings',
    nullable: true,
    comment: 'Encrypted privacy settings data',
  })
  privacySettings?: PrivacySettings;

  @Column({
    type: 'boolean',
    name: 'is_active',
    default: true,
  })
  @Index('user_is_active_idx')
  isActive: boolean;

  @Column({
    type: 'simple-json',
    nullable: true,
  })
  metadata?: Record<string, any>;
}
