import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_activation_tokens')
export class UserActivationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ unique: true })
  token: string;

  @Index()
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true, type: 'timestamp' })
  usedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
