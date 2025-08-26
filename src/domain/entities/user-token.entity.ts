import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type TokenType = 'activation' | 'password_reset' | 'email_change';

@Entity('user_tokens')
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ unique: true })
  token: string;

  @Index()
  @Column({ name: 'token_type', default: 'activation' })
  tokenType: TokenType;

  @Index()
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true, type: 'timestamp' })
  usedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
