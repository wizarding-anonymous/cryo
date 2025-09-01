import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DeviceInfo } from '../value-objects/device-info.vo';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('jsonb')
  deviceInfo: DeviceInfo;

  @Column({ length: 45 })
  ipAddress: string;

  @Column({ length: 500 })
  userAgent: string;

  @Column({ length: 64 })
  accessTokenHash: string;

  @Column({ length: 64 })
  refreshTokenHash: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ length: 50, nullable: true })
  terminatedReason: string;

  @Column({ type: 'timestamp', nullable: true })
  terminatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastActivityAt: Date;

  /**
   * Проверяет, истекла ли сессия
   */
  isExpired(): boolean {
    return this.expiresAt && this.expiresAt < new Date();
  }

  /**
   * Завершает сессию с указанием причины
   */
  terminate(reason: string): void {
    this.isActive = false;
    this.terminatedReason = reason;
    this.terminatedAt = new Date();
  }

  /**
   * Обновляет время последней активности
   */
  updateActivity(): void {
    this.lastActivityAt = new Date();
  }
}
