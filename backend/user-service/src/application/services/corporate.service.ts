import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateProfile } from '../../domain/entities/corporate-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { INN } from '../../domain/value-objects/inn.value-object';
import { OGRN } from '../../domain/value-objects/ogrn.value-object';

export interface CorporateCompanyData {
  companyName: string;
  inn: string;
  ogrn: string;
  kpp?: string;
  okpo?: string;
  okved?: string;
  legalAddress: string;
  actualAddress?: string;
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  website?: string;
  headquarters?: string;
  bankDetails?: {
    bankName: string;
    bik: string;
    correspondentAccount: string;
    currentAccount: string;
  };
  taxSystem?: 'osn' | 'usn_income' | 'usn_income_expense' | 'envd' | 'esn' | 'patent';
  isResident?: boolean;
  hasPersonalDataLicense?: boolean;
  personalDataRegistrationNumber?: string;
}

export interface EmployeeData {
  userId: string;
  role: 'admin' | 'manager' | 'employee' | 'readonly';
  department?: string;
  position?: string;
}

export interface CorporateProfileUpdate {
  companyName?: string;
  industry?: string;
  companySize?: 'small' | 'medium' | 'large' | 'enterprise';
  website?: string;
  headquarters?: string;
}

@Injectable()
export class CorporateService {
  constructor(
    @InjectRepository(CorporateProfile)
    private readonly corporateProfileRepository: Repository<CorporateProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createCorporateProfile(adminUserId: string, companyData: CorporateCompanyData): Promise<CorporateProfile> {
    const adminUser = await this.userRepository.findOneBy({ id: adminUserId });
    if (!adminUser) {
      throw new NotFoundException(`Admin user with ID ${adminUserId} not found`);
    }

    // Validate INN/OGRN
    new INN(companyData.inn);
    new OGRN(companyData.ogrn);

    // Check if corporate profile already exists for this admin
    const existingProfile = await this.corporateProfileRepository.findOneBy({ adminUserId });
    if (existingProfile) {
      throw new ConflictException('Corporate profile already exists for this admin user');
    }

    const corporateProfile = this.corporateProfileRepository.create({
      adminUserId,
      companyInfo: {
        name: companyData.companyName,
        legalName: companyData.companyName,
        inn: companyData.inn,
        ogrn: companyData.ogrn,
        kpp: companyData.kpp,
        okpo: companyData.okpo,
        okved: companyData.okved,
        industry: companyData.industry,
        companySize: companyData.companySize,
        headquarters: companyData.headquarters || '',
        website: companyData.website || '',
        legalAddress: companyData.legalAddress,
        actualAddress: companyData.actualAddress,
        bankDetails: companyData.bankDetails,
        taxSystem: companyData.taxSystem || 'osn',
        isResident: companyData.isResident ?? true,
        hasPersonalDataLicense: companyData.hasPersonalDataLicense,
        personalDataRegistrationNumber: companyData.personalDataRegistrationNumber,
      },
      organization: {
        departments: [],
        employees: [],
        hierarchy: {},
        roles: [],
      },
      subscription: {
        plan: 'basic',
        licenseCount: 10,
        usedLicenses: 0,
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalSpent: 0,
      },
      integrations: {
        ssoEnabled: false,
        apiIntegrations: [],
      },
      policies: {
        gameAccessPolicy: {},
        spendingLimits: {},
        contentFilters: [],
        workingHours: {},
        vacationPolicy: {},
      },
      usage: {
        monthlyActiveUsers: 0,
        totalGameHours: 0,
        popularGames: [],
        departmentUsage: [],
        costPerEmployee: 0,
      },
    });

    const savedProfile = await this.corporateProfileRepository.save(corporateProfile);

    // Publish corporate profile created event
    await this.eventPublisher.publish('corporate.profile.created', {
      corporateId: savedProfile.id,
      adminUserId,
      companyName: companyData.companyName,
      inn: companyData.inn,
      timestamp: new Date().toISOString(),
    });

    return savedProfile;
  }

  async updateCorporateProfile(corporateId: string, updates: CorporateProfileUpdate): Promise<CorporateProfile> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException(`Corporate profile with ID ${corporateId} not found`);
    }

    // Update company info
    if (updates.companyName) profile.companyInfo.name = updates.companyName;
    if (updates.industry) profile.companyInfo.industry = updates.industry;
    if (updates.companySize) profile.companyInfo.companySize = updates.companySize;
    if (updates.website) profile.companyInfo.website = updates.website;
    if (updates.headquarters) profile.companyInfo.headquarters = updates.headquarters;

    const updatedProfile = await this.corporateProfileRepository.save(profile);

    // Publish update event
    await this.eventPublisher.publish('corporate.profile.updated', {
      corporateId: updatedProfile.id,
      changedFields: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });

    return updatedProfile;
  }

  async addEmployee(corporateId: string, employeeData: EmployeeData, adminUserId: string): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException(`Corporate profile with ID ${corporateId} not found`);
    }

    const employee = await this.userRepository.findOneBy({ id: employeeData.userId });
    if (!employee) {
      throw new NotFoundException(`User with ID ${employeeData.userId} not found`);
    }

    // Check if employee already exists
    const existingEmployee = profile.organization.employees.find(emp => emp.userId === employeeData.userId);
    if (existingEmployee) {
      throw new ConflictException('Employee already exists in this corporate profile');
    }

    // Add employee to organization
    profile.organization.employees.push({
      userId: employeeData.userId,
      role: employeeData.role,
      department: employeeData.department,
      position: employeeData.position,
      addedAt: new Date(),
      addedBy: adminUserId,
    });

    profile.subscription.usedLicenses += 1;

    await this.corporateProfileRepository.save(profile);

    // Publish employee added event
    await this.eventPublisher.publish('corporate.employee.added', {
      corporateId,
      employeeId: employeeData.userId,
      role: employeeData.role,
      timestamp: new Date().toISOString(),
    });
  }

  async removeEmployee(corporateId: string, userId: string): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException(`Corporate profile with ID ${corporateId} not found`);
    }

    const employeeIndex = profile.organization.employees.findIndex(emp => emp.userId === userId);
    if (employeeIndex === -1) {
      throw new NotFoundException('Employee not found in this corporate profile');
    }

    // Remove employee
    profile.organization.employees.splice(employeeIndex, 1);
    profile.subscription.usedLicenses = Math.max(0, profile.subscription.usedLicenses - 1);

    await this.corporateProfileRepository.save(profile);

    // Publish employee removed event
    await this.eventPublisher.publish('corporate.employee.removed', {
      corporateId,
      employeeId: userId,
      timestamp: new Date().toISOString(),
    });
  }

  async getCorporateProfile(corporateId: string): Promise<CorporateProfile> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException(`Corporate profile with ID ${corporateId} not found`);
    }
    return profile;
  }

  async getCorporateProfileByAdminId(adminUserId: string): Promise<CorporateProfile> {
    const profile = await this.corporateProfileRepository.findOneBy({ adminUserId });
    if (!profile) {
      throw new NotFoundException(`Corporate profile for admin ${adminUserId} not found`);
    }
    return profile;
  }
}
