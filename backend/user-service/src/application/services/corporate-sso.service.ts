import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateProfile } from '../../domain/entities/corporate-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { AuthService } from './auth.service';
import { EventPublisher } from '../events/event-publisher.service';
import { RussianSSOService } from './russian-sso.service';

export interface SSOConfiguration {
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
  clientSecret: string;
  tenantId?: string; // For Azure AD
  domain?: string; // For Google Workspace / Yandex
  issuerUrl?: string; // For OIDC providers
  redirectUri: string;
  scopes: string[];
  // Российские специфичные поля
  organizationId?: string; // Для Госуслуг
  serviceId?: string; // Для корпоративных Госуслуг
  certPath?: string; // Путь к сертификату для ГОСТ
  keyPath?: string; // Путь к ключу для ГОСТ
}

export interface SSOUserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  groups?: string[];
}

@Injectable()
export class CorporateSSOService {
  private readonly logger = new Logger(CorporateSSOService.name);

  constructor(
    @InjectRepository(CorporateProfile)
    private readonly corporateProfileRepository: Repository<CorporateProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
    private readonly eventPublisher: EventPublisher,
    private readonly russianSSOService: RussianSSOService,
  ) {}

  /**
   * Настройка SSO для корпоративного профиля
   */
  async configureSSOProvider(corporateId: string, ssoConfig: SSOConfiguration): Promise<void> {
    this.logger.log(`Configuring SSO for corporate profile ${corporateId}`);

    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new BadRequestException('Corporate profile not found');
    }

    // Валидация конфигурации
    this.validateSSOConfiguration(ssoConfig);

    // Обновляем интеграции
    profile.integrations.ssoEnabled = true;
    profile.integrations.ssoProvider = {
      provider: ssoConfig.provider,
      clientId: ssoConfig.clientId,
      tenantId: ssoConfig.tenantId,
      domain: ssoConfig.domain,
      issuerUrl: ssoConfig.issuerUrl,
      redirectUri: ssoConfig.redirectUri,
      scopes: ssoConfig.scopes,
      configuredAt: new Date(),
    };

    await this.corporateProfileRepository.save(profile);

    // Публикуем событие
    await this.eventPublisher.publish('corporate.sso.configured', {
      corporateId,
      provider: ssoConfig.provider,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`SSO configured successfully for corporate profile ${corporateId}`);
  }

  /**
   * Отключение SSO
   */
  async disableSSOProvider(corporateId: string): Promise<void> {
    this.logger.log(`Disabling SSO for corporate profile ${corporateId}`);

    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile) {
      throw new BadRequestException('Corporate profile not found');
    }

    profile.integrations.ssoEnabled = false;
    profile.integrations.ssoProvider = null;

    await this.corporateProfileRepository.save(profile);

    await this.eventPublisher.publish('corporate.sso.disabled', {
      corporateId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`SSO disabled for corporate profile ${corporateId}`);
  }

  /**
   * Аутентификация через SSO
   */
  async authenticateWithSSO(
    corporateId: string,
    ssoToken: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    this.logger.log(`SSO authentication attempt for corporate ${corporateId}`);

    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile || !profile.integrations.ssoEnabled) {
      throw new UnauthorizedException('SSO is not enabled for this corporate profile');
    }

    // Валидация SSO токена и получение информации о пользователе
    const ssoUserInfo = await this.validateSSOToken(ssoToken, profile.integrations.ssoProvider);

    // Поиск существующего пользователя
    let user = await this.userRepository.findOneBy({ email: ssoUserInfo.email });

    if (!user) {
      // Создание нового пользователя
      user = await this.createUserFromSSO(ssoUserInfo);
    } else {
      // Проверка, что пользователь является сотрудником этой корпорации
      const isEmployee = profile.organization.employees.some((emp: any) => emp.userId === user.id);
      if (!isEmployee) {
        throw new UnauthorizedException('User is not an employee of this corporate profile');
      }
    }

    // Генерация токенов
    const deviceInfo = { type: 'desktop', os: 'unknown', browser: 'SSO', browserVersion: '1.0' };
    const tokens = await this.authService.login(user, deviceInfo as any, 'SSO', 'SSO Login');

    // Публикуем событие успешной аутентификации
    await this.eventPublisher.publish('corporate.sso.login', {
      corporateId,
      userId: user.id,
      provider: profile.integrations.ssoProvider.provider,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`SSO authentication successful for user ${user.id}`);

    return { user, ...tokens };
  }

  /**
   * Синхронизация пользователей из SSO провайдера
   */
  async syncUsersFromSSO(corporateId: string): Promise<{ synced: number; errors: string[] }> {
    this.logger.log(`Starting user sync from SSO for corporate ${corporateId}`);

    const profile = await this.corporateProfileRepository.findOneBy({ id: corporateId });
    if (!profile || !profile.integrations.ssoEnabled) {
      throw new BadRequestException('SSO is not enabled for this corporate profile');
    }

    const errors: string[] = [];
    let syncedCount = 0;

    try {
      // Получение списка пользователей из SSO провайдера
      const ssoUsers = await this.fetchUsersFromSSOProvider(profile.integrations.ssoProvider);

      for (const ssoUser of ssoUsers) {
        try {
          let user = await this.userRepository.findOneBy({ email: ssoUser.email });

          if (!user) {
            // Создание нового пользователя
            user = await this.createUserFromSSO(ssoUser);
            syncedCount++;
          } else {
            // Обновление существующего пользователя
            await this.updateUserFromSSO(user, ssoUser);
            syncedCount++;
          }

          // Добавление в корпоративный профиль если еще не добавлен
          const isEmployee = profile.organization.employees.some((emp: any) => emp.userId === user.id);
          if (!isEmployee) {
            profile.organization.employees.push({
              userId: user.id,
              role: 'employee',
              department: ssoUser.department,
              position: ssoUser.position,
              addedAt: new Date(),
              addedBy: 'sso-sync',
            });
          }
        } catch (error) {
          errors.push(`Failed to sync user ${ssoUser.email}: ${error.message}`);
        }
      }

      await this.corporateProfileRepository.save(profile);

      // Публикуем событие синхронизации
      await this.eventPublisher.publish('corporate.sso.sync.completed', {
        corporateId,
        syncedUsers: syncedCount,
        errors: errors.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`SSO sync failed for corporate ${corporateId}`, error.stack);
      errors.push(`Sync failed: ${error.message}`);
    }

    this.logger.log(
      `SSO sync completed for corporate ${corporateId}: ${syncedCount} users synced, ${errors.length} errors`,
    );

    return { synced: syncedCount, errors };
  }

  /**
   * Валидация конфигурации SSO
   */
  private validateSSOConfiguration(config: SSOConfiguration): void {
    if (!config.clientId || !config.clientSecret) {
      throw new BadRequestException('Client ID and Client Secret are required');
    }

    // Западные провайдеры
    if (config.provider === 'azure_ad' && !config.tenantId) {
      throw new BadRequestException('Tenant ID is required for Azure AD');
    }

    if (config.provider === 'google_workspace' && !config.domain) {
      throw new BadRequestException('Domain is required for Google Workspace');
    }

    if (['okta', 'keycloak'].includes(config.provider) && !config.issuerUrl) {
      throw new BadRequestException('Issuer URL is required for OIDC providers');
    }

    // Российские провайдеры
    if (config.provider === 'gosuslugi') {
      if (!config.organizationId) {
        throw new BadRequestException('Organization ID is required for Госуслуги');
      }
      if (!config.certPath || !config.keyPath) {
        throw new BadRequestException('ГОСТ сертификат и ключ обязательны для Госуслуг');
      }
    }

    if (config.provider === 'yandex_id' && !config.domain) {
      throw new BadRequestException('Domain is required for Яндекс ID');
    }

    if (config.provider === 'astra_linux_ad' && !config.issuerUrl) {
      throw new BadRequestException('Issuer URL is required for Astra Linux AD');
    }

    if (['sber_id', 'my_team'].includes(config.provider) && !config.issuerUrl) {
      throw new BadRequestException('Issuer URL is required for российские корпоративные провайдеры');
    }
  }

  /**
   * Валидация SSO токена с поддержкой российских провайдеров
   */
  private async validateSSOToken(token: string, ssoProvider: any): Promise<SSOUserInfo> {
    this.logger.log(`Validating SSO token with provider ${ssoProvider.provider}`);

    // Имитация валидации токена
    if (!token || token === 'invalid') {
      throw new UnauthorizedException('Invalid SSO token');
    }

    // Российские провайдеры
    const russianProviders = ['gosuslugi', 'yandex_id', 'vk_id', 'sber_id', 'my_team', 'astra_linux_ad'];
    if (russianProviders.includes(ssoProvider.provider)) {
      return this.russianSSOService.validateRussianSSOToken(token, ssoProvider);
    }

    // Западные провайдеры (для международных компаний)
    return this.validateWesternSSOToken(token, ssoProvider);
  }

  /**
   * Валидация токенов западных провайдеров
   */
  private async validateWesternSSOToken(token: string, ssoProvider: any): Promise<SSOUserInfo> {
    this.logger.log(`Validating Western SSO token with provider ${ssoProvider.provider}`);

    // В реальной реализации здесь была бы интеграция с конкретным SSO провайдером
    // Мок данные пользователя для западных провайдеров
    return {
      id: 'sso-user-123',
      email: 'john.doe@company.com',
      firstName: 'John',
      lastName: 'Doe',
      department: 'Engineering',
      position: 'Senior Developer',
      groups: ['developers', 'employees'],
    };
  }

  /**
   * Получение пользователей из SSO провайдера с поддержкой российских провайдеров
   */
  private async fetchUsersFromSSOProvider(ssoProvider: any): Promise<SSOUserInfo[]> {
    this.logger.log(`Fetching users from SSO provider ${ssoProvider.provider}`);

    // Российские провайдеры
    const russianProviders = ['gosuslugi', 'yandex_id', 'vk_id', 'sber_id', 'my_team', 'astra_linux_ad'];
    if (russianProviders.includes(ssoProvider.provider)) {
      return this.russianSSOService.fetchUsersFromRussianProvider(ssoProvider);
    }

    // Западные провайдеры (для международных компаний)
    return this.fetchUsersFromWesternProvider(ssoProvider);
  }

  /**
   * Получение пользователей из западных провайдеров
   */
  private async fetchUsersFromWesternProvider(ssoProvider: any): Promise<SSOUserInfo[]> {
    this.logger.log(`Fetching users from Western provider ${ssoProvider.provider}`);

    // В реальной реализации здесь была бы интеграция с API провайдера
    // Возвращаем мок данные для западных провайдеров
    return [
      {
        id: 'sso-user-1',
        email: 'alice@company.com',
        firstName: 'Alice',
        lastName: 'Smith',
        department: 'Engineering',
        position: 'Team Lead',
        groups: ['developers', 'leads'],
      },
      {
        id: 'sso-user-2',
        email: 'bob@company.com',
        firstName: 'Bob',
        lastName: 'Johnson',
        department: 'Marketing',
        position: 'Marketing Manager',
        groups: ['marketing', 'managers'],
      },
    ];
  }

  /**
   * Создание пользователя из SSO данных
   */
  private async createUserFromSSO(ssoUserInfo: SSOUserInfo): Promise<User> {
    const user = this.userRepository.create({
      email: ssoUserInfo.email,
      username: ssoUserInfo.email.split('@')[0],
      firstName: ssoUserInfo.firstName,
      lastName: ssoUserInfo.lastName,
      emailVerified: true, // SSO пользователи считаются верифицированными
      isActive: true,
      passwordHash: 'sso-managed', // Пароль управляется через SSO
      createdViaSSO: true,
      ssoProviderId: ssoUserInfo.id,
    });

    return await this.userRepository.save(user);
  }

  /**
   * Обновление пользователя из SSO данных
   */
  private async updateUserFromSSO(user: User, ssoUserInfo: SSOUserInfo): Promise<User> {
    user.firstName = ssoUserInfo.firstName || user.firstName;
    user.lastName = ssoUserInfo.lastName || user.lastName;
    user.ssoProviderId = ssoUserInfo.id;

    return await this.userRepository.save(user);
  }
}
