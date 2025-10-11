import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('token_blacklist')
@Index(['tokenHash'], { unique: true })
@Index(['userId', 'blacklistedAt'])
@Index(['expiresAt'])
@Index(['reason', 'blacklistedAt'])
export class TokenBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  @Index()
  tokenHash: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ 
    type: 'enum',
    enum: ['logout', 'security', 'expired', 'refresh', 'admin'],
    default: 'logout'
  })
  @Index()
  reason: 'logout' | 'security' | 'expired' | 'refresh' | 'admin';

  @Column({ type: 'timestamp with time zone' })
  @Index()
  expiresAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  blacklistedAt: Date;
}