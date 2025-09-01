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
import {
  CompanyInfo,
  OrganizationStructure,
  CorporateSubscription,
  CorporateIntegrations,
  CorporatePolicies,
  CorporateUsage,
} from '../interfaces/corporate-profile.interfaces';

@Entity('corporate_profiles')
export class CorporateProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'admin_user_id', unique: true })
  adminUserId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser: User;

  @Column({ type: 'jsonb', default: {}, name: 'company_info' })
  companyInfo: CompanyInfo;

  @Column({ type: 'jsonb', default: {}, name: 'organization' })
  organization: OrganizationStructure;

  @Column({ type: 'jsonb', default: {}, name: 'subscription' })
  subscription: CorporateSubscription;

  @Column({ type: 'jsonb', default: {}, name: 'integrations' })
  integrations: CorporateIntegrations;

  @Column({ type: 'jsonb', default: {}, name: 'policies' })
  policies: CorporatePolicies;

  @Column({ type: 'jsonb', default: {}, name: 'usage' })
  usage: CorporateUsage;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    name: 'updated_at',
  })
  updatedAt: Date;
}
