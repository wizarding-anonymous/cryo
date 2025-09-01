import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('reputation_history')
export class ReputationEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('int')
  change: number;

  @Column('text')
  reason: string;

  @Column('varchar', { length: 50 })
  source: 'system' | 'user_review' | 'community_vote' | 'admin_action';

  @Column('varchar', { length: 255, nullable: true })
  sourceId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
