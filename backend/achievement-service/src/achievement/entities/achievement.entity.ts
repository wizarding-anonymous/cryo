import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserAchievement } from './user-achievement.entity';

export enum AchievementType {
  FIRST_PURCHASE = 'first_purchase',
  FIRST_REVIEW = 'first_review',
  FIRST_FRIEND = 'first_friend',
  GAMES_PURCHASED = 'games_purchased',
  REVIEWS_WRITTEN = 'reviews_written',
}

export interface AchievementCondition {
  type: 'count' | 'first_time' | 'threshold';
  target?: number;
  field?: string;
}

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: AchievementType,
  })
  @Index()
  type!: AchievementType;

  @Column({ type: 'jsonb' })
  condition!: AchievementCondition;

  @Column({ type: 'varchar', length: 255, nullable: true })
  iconUrl!: string;

  @Column({ type: 'int', default: 0 })
  points!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.achievement)
  userAchievements!: UserAchievement[];
}