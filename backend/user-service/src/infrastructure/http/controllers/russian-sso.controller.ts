import { Controller, Post, Body, Param, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CorporateSSOService, SSOConfiguration } from '../../../application/services/corporate-sso.service';
import { RussianSSOService } from '../../../application/services/russian-sso.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

class ConfigureRussianSSODto {
  provider: 'gosuslugi' | 'yandex_id' | 'vk_id' | 'sber_id' | 'my_team' | 'astra_linux_ad';
  clientId: string;
  clientSecret: string;
  domain?: string;
  organizationId?: string;
  serviceId?: string;
  certPath?: string;
  keyPath?: string;
  redirectUri: string;
  scopes: string[];
}

class RussianSSOLoginDto {
  ssoToken: string;
  provider: 'gosuslugi' | 'yandex_id' | 'vk_id' | 'sber_id' | 'my_team' | 'astra_linux_ad';
}

@ApiTags('🇷🇺 Российские SSO провайдеры')
@Controller('corporate/russian-sso')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RussianSSOController {
  constructor(
    private readonly corporateSSOService: CorporateSSOService,
    private readonly russianSSOService: RussianSSOService,
  ) {}

  @Post(':corporateId/configure')
  @Roles('corporate_admin')
  @ApiOperation({
    summary: 'Настройка российского SSO провайдера',
    description:
      'Настройка интеграции с российскими SSO провайдерами: Госуслуги, Яндекс ID, VK ID, Сбер ID, MyTeam, Astra Linux AD',
  })
  @ApiResponse({ status: 200, description: 'SSO провайдер успешно настроен' })
  @ApiResponse({ status: 400, description: 'Некорректные данные конфигурации' })
  @ApiResponse({ status: 404, description: 'Корпоративный профиль не найден' })
  async configureRussianSSO(
    @Param('corporateId') corporateId: string,
    @Body() configDto: ConfigureRussianSSODto,
  ): Promise<{ message: string }> {
    const ssoConfig: SSOConfiguration = {
      provider: configDto.provider,
      clientId: configDto.clientId,
      clientSecret: configDto.clientSecret,
      domain: configDto.domain,
      organizationId: configDto.organizationId,
      serviceId: configDto.serviceId,
      certPath: configDto.certPath,
      keyPath: configDto.keyPath,
      redirectUri: configDto.redirectUri,
      scopes: configDto.scopes,
    };

    await this.corporateSSOService.configureSSOProvider(corporateId, ssoConfig);

    return {
      message: `Российский SSO провайдер ${configDto.provider} успешно настроен для корпоративного профиля ${corporateId}`,
    };
  }

  @Post(':corporateId/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Вход через российский SSO',
    description: 'Аутентификация сотрудника через российские SSO провайдеры',
  })
  @ApiResponse({
    status: 200,
    description: 'Успешная аутентификация',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        provider: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Неверный SSO токен' })
  @ApiResponse({ status: 404, description: 'Корпоративный профиль не найден или SSO не настроен' })
  async loginWithRussianSSO(
    @Param('corporateId') corporateId: string,
    @Body() loginDto: RussianSSOLoginDto,
  ): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    provider: string;
  }> {
    const result = await this.corporateSSOService.authenticateWithSSO(corporateId, loginDto.ssoToken);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      provider: loginDto.provider,
    };
  }

  @Post(':corporateId/sync-users')
  @Roles('corporate_admin')
  @ApiOperation({
    summary: 'Синхронизация пользователей из российского SSO',
    description: 'Синхронизация списка сотрудников из российских корпоративных систем',
  })
  @ApiResponse({
    status: 200,
    description: 'Синхронизация завершена',
    schema: {
      type: 'object',
      properties: {
        synced: { type: 'number', description: 'Количество синхронизированных пользователей' },
        errors: { type: 'array', items: { type: 'string' }, description: 'Ошибки синхронизации' },
      },
    },
  })
  async syncUsersFromRussianSSO(
    @Param('corporateId') corporateId: string,
  ): Promise<{ synced: number; errors: string[] }> {
    return this.corporateSSOService.syncUsersFromSSO(corporateId);
  }

  @Get(':corporateId/providers')
  @Roles('corporate_admin', 'corporate_manager')
  @ApiOperation({
    summary: 'Список доступных российских SSO провайдеров',
    description: 'Получение списка поддерживаемых российских SSO провайдеров с описанием',
  })
  @ApiResponse({
    status: 200,
    description: 'Список провайдеров',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          requirements: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  async getRussianSSOProviders(): Promise<any[]> {
    return [
      {
        id: 'gosuslugi',
        name: 'Госуслуги',
        description: 'Единая система идентификации и аутентификации (ЕСИА)',
        features: [
          'Государственная система аутентификации',
          'ГОСТ-совместимая криптография',
          'Высокий уровень доверия',
          'Интеграция с государственными реестрами',
        ],
        requirements: ['ГОСТ сертификат', 'Регистрация в ЕСИА', 'Соглашение об информационном взаимодействии'],
      },
      {
        id: 'yandex_id',
        name: 'Яндекс ID',
        description: 'Корпоративная система аутентификации Яндекса',
        features: [
          'Интеграция с Яндекс.Директорией',
          'Управление доступом к корпоративным ресурсам',
          'Двухфакторная аутентификация',
          'Аудит входов',
        ],
        requirements: ['Корпоративный домен в Яндексе', 'Настройка OAuth приложения'],
      },
      {
        id: 'vk_id',
        name: 'VK ID',
        description: 'Система аутентификации VK для бизнеса',
        features: [
          'Интеграция с VK Teams',
          'Управление корпоративными аккаунтами',
          'Безопасная аутентификация',
          'API для интеграции',
        ],
        requirements: ['Корпоративный аккаунт VK', 'Настройка VK приложения'],
      },
      {
        id: 'sber_id',
        name: 'Сбер ID',
        description: 'Корпоративная система аутентификации Сбербанка',
        features: [
          'Банковский уровень безопасности',
          'Интеграция с корпоративными системами Сбера',
          'Биометрическая аутентификация',
          'Соответствие требованиям ЦБ РФ',
        ],
        requirements: ['Партнерское соглашение со Сбером', 'Сертификация безопасности'],
      },
      {
        id: 'my_team',
        name: 'MyTeam',
        description: 'Корпоративный мессенджер Mail.ru Group',
        features: [
          'Интеграция с корпоративным мессенджером',
          'Управление командами',
          'Безопасные коммуникации',
          'API для интеграции',
        ],
        requirements: ['Корпоративный аккаунт MyTeam', 'Настройка бота или приложения'],
      },
      {
        id: 'astra_linux_ad',
        name: 'Astra Linux AD',
        description: 'Active Directory для Astra Linux',
        features: [
          'Российская операционная система',
          'Соответствие требованиям ФСТЭК',
          'Интеграция с доменными службами',
          'Высокий уровень защищенности',
        ],
        requirements: ['Astra Linux сервер', 'Настройка доменных служб', 'Сертификаты безопасности'],
      },
    ];
  }

  @Post(':corporateId/disable')
  @Roles('corporate_admin')
  @ApiOperation({
    summary: 'Отключение российского SSO',
    description: 'Отключение интеграции с российским SSO провайдером',
  })
  @ApiResponse({ status: 200, description: 'SSO провайдер отключен' })
  async disableRussianSSO(@Param('corporateId') corporateId: string): Promise<{ message: string }> {
    await this.corporateSSOService.disableSSOProvider(corporateId);
    return { message: 'Российский SSO провайдер успешно отключен' };
  }
}
