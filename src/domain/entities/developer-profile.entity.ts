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

@Entity('developer_profiles')
export class DeveloperProfile {
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

  @Column({ type: 'varchar', length: 12, nullable: true })
  inn?: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  ogrn?: string;

  @Column({ type: 'text', nullable: true, name: 'legal_address' })
  legalAddress?: string;

  @Column({ type: 'varchar', length: 255, name: 'contact_email' })
  contactEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'contact_phone' })
  contactPhone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ type: 'jsonb', default: {}, name: 'studio_info' })
  studioInfo: object;

  @Column({ type: 'jsonb', default: {}, name: 'portfolio' })
  portfolio: object;

  @Column({ type: 'jsonb', default: {}, name: 'stats' })
  stats: object;

  @Column({ type: 'jsonb', default: {}, name: 'social' })
  social: object;

  @Column({ type: 'jsonb', default: {}, name: 'profile_settings' })
  profileSettings: object;

  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'verification_status' })
  verificationStatus: string;

  @Column({ type: 'jsonb', default: [], name: 'verification_documents' })
  verificationDocuments: object[];

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verifiedAt?: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
