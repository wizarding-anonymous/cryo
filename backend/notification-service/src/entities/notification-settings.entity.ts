import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  @Index()
  userId!: string;

  @Column({ default: true })
  inAppNotifications!: boolean;

  @Column({ default: true })
  emailNotifications!: boolean;

  // Настройки по типам уведомлений
  @Column({ default: true })
  friendRequests!: boolean;

  @Column({ default: true })
  gameUpdates!: boolean;

  @Column({ default: true })
  achievements!: boolean;

  @Column({ default: true })
  purchases!: boolean;

  @Column({ default: true })
  systemNotifications!: boolean;

  @UpdateDateColumn()
  updatedAt!: Date;
}