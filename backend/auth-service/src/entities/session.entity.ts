import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sessions')
@Index(['userId', 'isActive'])
@Index(['accessTokenHash'])
@Index(['refreshTokenHash'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'text' })
  accessTokenHash: string;

  @Column({ type: 'text' })
  refreshTokenHash: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'text' })
  userAgent: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  expiresAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastAccessedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}