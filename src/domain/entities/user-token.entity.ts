import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type TokenType = 'activation' | 'password_reset' | 'email_change' | 'sms_verification';

@Entity('user_tokens')
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ unique: true })
  token: string;

  @Index()
  @Column({ name: 'token_type', default: 'activation' })
  tokenType: TokenType;

  // Alias for compatibility
  get type(): TokenType {
    return this.tokenType;
  }

  set type(value: TokenType) {
    this.tokenType = value;
  }

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Index()
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true, type: 'timestamp' })
  usedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
