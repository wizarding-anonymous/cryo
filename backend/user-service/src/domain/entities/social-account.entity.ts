import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('social_accounts')
@Index(['provider', 'providerUserId'], { unique: true })
export class SocialAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_user_id' })
  providerUserId: string;

  // Alias for compatibility
  get providerId(): string {
    return this.providerUserId;
  }

  set providerId(value: string) {
    this.providerUserId = value;
  }

  @Column({ type: 'jsonb', name: 'provider_data', nullable: true })
  providerData?: object;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'linked_at' })
  linkedAt: Date;
}
