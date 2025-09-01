// Интерфейсы для JSONB полей CorporateProfile

export interface CompanyInfo {
  name: string;
  legalName?: string;
  inn: string;
  ogrn: string;
  kpp?: string; // Код причины постановки на учет
  okpo?: string; // Общероссийский классификатор предприятий и организаций
  okved?: string; // Общероссийский классификатор видов экономической деятельности
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  annualRevenue?: number;
  headquarters: string;
  website: string;
  // Российские специфичные поля
  legalAddress: string; // Юридический адрес
  actualAddress?: string; // Фактический адрес
  bankDetails?: {
    bankName: string;
    bik: string;
    correspondentAccount: string;
    currentAccount: string;
  };
  taxSystem?: 'osn' | 'usn_income' | 'usn_income_expense' | 'envd' | 'esn' | 'patent'; // Налоговая система
  isResident: boolean; // Резидент РФ
  hasPersonalDataLicense?: boolean; // Лицензия на обработку персональных данных
  personalDataRegistrationNumber?: string; // Номер в реестре операторов персональных данных
}

export interface CorporateEmployee {
  userId: string;
  role: 'admin' | 'manager' | 'employee' | 'readonly';
  department?: string;
  position?: string;
  addedAt: Date;
  addedBy: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  parentDepartmentId?: string;
  managerUserId?: string;
  budgetLimit?: number;
}

export interface OrganizationStructure {
  employees: CorporateEmployee[];
  departments: Department[];
  hierarchy: any; // Можно детализировать позже
  roles: any[]; // Можно детализировать позже
}

export interface CorporateSubscription {
  plan: 'basic' | 'professional' | 'enterprise';
  licenseCount: number;
  usedLicenses: number;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  nextBillingDate: Date;
  totalSpent: number;
}

export interface SSOProvider {
  provider:
    | 'azure_ad'
    | 'google_workspace'
    | 'okta'
    | 'keycloak'
    | 'gosuslugi'
    | 'yandex_id'
    | 'vk_id'
    | 'sber_id'
    | 'my_team'
    | 'astra_linux_ad';
  clientId: string;
  tenantId?: string;
  domain?: string;
  issuerUrl?: string;
  redirectUri: string;
  scopes: string[];
  configuredAt: Date;
  // Российские специфичные поля
  organizationId?: string; // Для Госуслуг
  serviceId?: string; // Для корпоративных Госуслуг
  certPath?: string; // Путь к сертификату для ГОСТ
  keyPath?: string; // Путь к ключу для ГОСТ
  gostCompliant?: boolean; // Соответствие ГОСТ
}

export interface CorporateIntegrations {
  ssoEnabled: boolean;
  ssoProvider?: SSOProvider;
  ldapIntegration?: any;
  apiIntegrations: any[];
}

export interface CorporatePolicies {
  gameAccessPolicy: any;
  spendingLimits: any;
  contentFilters: any[];
  workingHours: any;
  vacationPolicy: any;
}

export interface CorporateUsage {
  monthlyActiveUsers: number;
  totalGameHours: number;
  popularGames: any[];
  departmentUsage: any[];
  costPerEmployee: number;
}
