import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('publisher_profiles')
export class PublisherProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, name: 'company_name' })
  companyName: string;

  @Column({ type: 'varchar', length: 50, name: 'company_type' })
  companyType: string;

  @Column({ type: 'jsonb', default: {}, name: 'corporate_info' })
  corporateInfo: object;

  @Column({ type: 'jsonb', default: {}, name: 'contacts' })
  contacts: object;

  @Column({ type: 'jsonb', default: {}, name: 'branding' })
  branding: object;

  @Column({ type: 'jsonb', default: {}, name: 'studios' })
  studios: object;

  @Column({ type: 'jsonb', default: {}, name: 'portfolio' })
  portfolio: object;

  @Column({ type: 'jsonb', default: {}, name: 'analytics' })
  analytics: object;

  @Column({ type: 'jsonb', default: {}, name: 'verification' })
  verification: object;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
