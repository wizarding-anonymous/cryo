import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('user_progress')
@Index(['userId', 'achievementId'], { unique: true })
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'uuid' })
  @Index()
  achievementId!: string;

  @Column({ type: 'int', default: 0 })
  currentValue!: number;

  @Column({ type: 'int' })
  targetValue!: number;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Achievement)
  @JoinColumn({ name: 'achievementId' })
  achievement!: Achievement;
}
