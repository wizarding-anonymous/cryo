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

export interface CorporateCompanyInfo {
  name: string;
  legalName: string;
  inn: string;
  ogrn: string;
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  annualRevenue?: number;
  headquarters: string;
  website: string;
}

export interface CorporateEmployee {
  userId: string;
  role: string;
  department?: string;
  position?: string;
  permissions?: string[];
  addedAt: Date;
}

export interface CorporateDepartment {
  id: string;
  name: string;
  description?: string;
  parentDepartmentId?: string;
  managerUserId?: string;
  budgetLimit?: number;
  createdAt: Date;
}

export interface CorporateOrganization {
  departments: CorporateDepartment[];
  employees: CorporateEmployee[];
  hierarchy: Record<string, any>;
  roles: any[];
}

export interface CorporateSubscription {
  plan: string;
  licenseCount: number;
  usedLicenses: number;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  nextBillingDate: Date;
  totalSpent: number;
}

export interface CorporateIntegrations {
  ssoEnabled: boolean;
  ssoProvider?: string;
  ssoConfiguration?: Record<string, any>;
  apiIntegrations: any[];
}

export interface CorporatePolicies {
  gameAccessPolicy: Record<string, any>;
  spendingLimits: Record<string, any>;
  contentFilters: any[];
  workingHours: Record<string, any>;
  vacationPolicy: Record<string, any>;
}

export interface CorporateUsage {
  monthlyActiveUsers: number;
  totalGameHours: number;
  popularGames: any[];
  departmentUsage: any[];
  costPerEmployee: number;
}

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
  companyInfo: CorporateCompanyInfo;

  @Column({ type: 'jsonb', default: {}, name: 'organization' })
  organization: CorporateOrganization;

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

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
