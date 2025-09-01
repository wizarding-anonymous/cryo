import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  CorporateProfile, 
  CorporateEmployee,
  CorporateDepartment 
} from '../../domain/entities/corporate-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';

export interface CorporateCompanyData {
  companyName: string;
  legalName: string;
  inn: string;
  ogrn: string;
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  annualRevenue?: number;
  headquarters: string;
  website: string;
}

export interface EmployeeData {
  userId: string;
  role: string;
  department?: string;
  position?: string;
  permissions?: string[];
}

export interface DepartmentData {
  name: string;
  description?: string;
  parentDepartmentId?: string;
  managerUserId?: string;
  budgetLimit?: number;
}

export interface SSOConfiguration {
  provider: 'azure_ad' | 'google_workspace' | 'okta' | 'custom';
  clientId: string;
  clientSecret: string;
  domain: string;
  redirectUri: string;
  scopes: string[];
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
    // Проверяем что пользователь существует
    const adminUser = await this.userRepository.findOneBy({ id: adminUserId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    // Проверяем уникальность ИНН
    const existingProfile = await this.corporateProfileRepository.findOne({
      where: { companyInfo: { inn: companyData.inn } as any }
    });
    if (existingProfile) {
      throw new BadRequestException('Company with this INN already exists');
    }

    const corporateProfile = this.corporateProfileRepository.create({
      adminUserId,
      companyInfo: {
        name: companyData.companyName,
        legalName: companyData.legalName,
        inn: companyData.inn,
        ogrn: companyData.ogrn,
        industry: companyData.industry,
        companySize: companyData.companySize,
        annualRevenue: companyData.annualRevenue,
        headquarters: companyData.headquarters,
        website: companyData.website,
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
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        totalSpent: 0,
      },
      integrations: {
        ssoEnabled: false,
        apiIntegrations: [],
      },
      policies: {
        gameAccessPolicy: { allowedCategories: [], blockedCategories: [] },
        spendingLimits: { monthly: 0, perEmployee: 0 },
        contentFilters: [],
        workingHours: { start: '09:00', end: '18:00', timezone: 'Europe/Moscow' },
        vacationPolicy: { maxDays: 28, carryOver: true },
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

    // Отправляем событие о создании корпоративного профиля
    await this.eventPublisher.publish('CorporateProfileCreated', {
      corporateId: savedProfile.id,
      adminUserId,
      companyName: companyData.companyName,
      inn: companyData.inn,
      createdAt: new Date(),
    });

    return savedProfile;
  }

  async updateCorporateProfile(corporateId: string, updates: Partial<CorporateCompanyData>): Promise<CorporateProfile> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    // Обновляем информацию о компании
    profile.companyInfo = { ...profile.companyInfo, ...updates };
    profile.updatedAt = new Date();

    const updatedProfile = await this.corporateProfileRepository.save(profile);

    // Отправляем событие об обновлении
    await this.eventPublisher.publish('CorporateProfileUpdated', {
      corporateId,
      changedFields: Object.keys(updates),
      updatedAt: new Date(),
    });

    return updatedProfile;
  }

  async addEmployee(corporateId: string, employeeData: EmployeeData): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    // Проверяем что пользователь существует
    const user = await this.userRepository.findOneBy({ id: employeeData.userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Проверяем лимиты лицензий
    if (profile.subscription.usedLicenses >= profile.subscription.licenseCount) {
      throw new BadRequestException('License limit exceeded');
    }

    // Добавляем сотрудника
    const employees: CorporateEmployee[] = profile.organization.employees || [];
    const existingEmployee = employees.find((emp: CorporateEmployee) => emp.userId === employeeData.userId);
    if (existingEmployee) {
      throw new BadRequestException('User is already an employee');
    }

    employees.push({
      userId: employeeData.userId,
      role: employeeData.role,
      department: employeeData.department,
      position: employeeData.position,
      permissions: employeeData.permissions || [],
      addedAt: new Date(),
    });

    profile.organization.employees = employees;
    profile.subscription.usedLicenses += 1;
    profile.updatedAt = new Date();

    await this.corporateProfileRepository.save(profile);

    // Отправляем событие о добавлении сотрудника
    await this.eventPublisher.publish('CorporateEmployeeAdded', {
      corporateId,
      userId: employeeData.userId,
      role: employeeData.role,
      addedAt: new Date(),
    });
  }

  async removeEmployee(corporateId: string, userId: string): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    const employees: CorporateEmployee[] = profile.organization.employees || [];
    const employeeIndex = employees.findIndex((emp: CorporateEmployee) => emp.userId === userId);
    if (employeeIndex === -1) {
      throw new NotFoundException('Employee not found');
    }

    // Удаляем сотрудника
    employees.splice(employeeIndex, 1);
    profile.organization.employees = employees;
    profile.subscription.usedLicenses = Math.max(0, profile.subscription.usedLicenses - 1);
    profile.updatedAt = new Date();

    await this.corporateProfileRepository.save(profile);

    // Отправляем событие об удалении сотрудника
    await this.eventPublisher.publish('CorporateEmployeeRemoved', {
      corporateId,
      userId,
      removedAt: new Date(),
    });
  }

  async updateEmployeeRole(corporateId: string, userId: string, role: string): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    const employees: CorporateEmployee[] = profile.organization.employees || [];
    const employee = employees.find((emp: CorporateEmployee) => emp.userId === userId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const oldRole = employee.role;
    employee.role = role;
    profile.updatedAt = new Date();

    await this.corporateProfileRepository.save(profile);

    // Отправляем событие об изменении роли
    await this.eventPublisher.publish('CorporateEmployeeRoleChanged', {
      corporateId,
      userId,
      oldRole,
      newRole: role,
      updatedAt: new Date(),
    });
  }

  async createDepartment(corporateId: string, departmentData: DepartmentData): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    const departments: CorporateDepartment[] = profile.organization.departments || [];
    const departmentId = `dept_${Date.now()}`;

    departments.push({
      id: departmentId,
      name: departmentData.name,
      description: departmentData.description,
      parentDepartmentId: departmentData.parentDepartmentId,
      managerUserId: departmentData.managerUserId,
      budgetLimit: departmentData.budgetLimit,
      createdAt: new Date(),
    });

    profile.organization.departments = departments;
    profile.updatedAt = new Date();

    await this.corporateProfileRepository.save(profile);

    // Отправляем событие о создании департамента
    await this.eventPublisher.publish('CorporateDepartmentCreated', {
      corporateId,
      departmentId,
      name: departmentData.name,
      createdAt: new Date(),
    });
  }

  async configureSSOProvider(corporateId: string, ssoConfig: SSOConfiguration): Promise<void> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }

    profile.integrations.ssoEnabled = true;
    profile.integrations.ssoProvider = ssoConfig.provider;
    profile.integrations.ssoConfiguration = {
      clientId: ssoConfig.clientId,
      // НЕ сохраняем clientSecret в открытом виде - должен быть зашифрован
      domain: ssoConfig.domain,
      redirectUri: ssoConfig.redirectUri,
      scopes: ssoConfig.scopes,
    };
    profile.updatedAt = new Date();

    await this.corporateProfileRepository.save(profile);

    // Отправляем событие о настройке SSO
    await this.eventPublisher.publish('CorporateSSOConfigured', {
      corporateId,
      provider: ssoConfig.provider,
      configuredAt: new Date(),
    });
  }

  async getCorporateProfile(corporateId: string): Promise<CorporateProfile> {
    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new NotFoundException('Corporate profile not found');
    }
    return profile;
  }

  async getCorporateUsageStats(corporateId: string, dateRange: { from: Date; to: Date }): Promise<any> {
    const profile = await this.getCorporateProfile(corporateId);
    
    // В реальной реализации здесь был бы запрос к аналитическому сервису
    return {
      period: dateRange,
      activeUsers: profile.usage.monthlyActiveUsers,
      totalGameHours: profile.usage.totalGameHours,
      popularGames: profile.usage.popularGames,
      departmentUsage: profile.usage.departmentUsage,
      costPerEmployee: profile.usage.costPerEmployee,
      licenseUtilization: (profile.subscription.usedLicenses / profile.subscription.licenseCount) * 100,
    };
  }
}
