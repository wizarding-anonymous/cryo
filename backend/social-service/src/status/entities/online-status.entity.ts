import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserStatus } from './user-status.enum';

@Entity('online_status')
export class OnlineStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  @Index()
  userId!: string;

  @Column('enum', { enum: UserStatus })
  status!: UserStatus;

  @Column('timestamp')
  lastSeen!: Date;

  @Column('varchar', { length: 100, nullable: true })
  currentGame?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
