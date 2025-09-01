import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { RussianSSOService } from '../russian-sso.service';
import { SSOConfiguration } from '../corporate-sso.service';

describe('RussianSSOService', () => {
  let service: RussianSSOService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RussianSSOService],
    }).compile();

    service = module.get<RussianSSOService>(RussianSSOService);
  });

  describe('validateRussianSSOToken', () => {
    it('should validate Госуслуги token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'gosuslugi',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        organizationId: 'test-org',
        certPath: '/path/to/cert',
        keyPath: '/path/to/key',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('ivanov.ivan@company.ru');
      expect(result.firstName).toBe('Иван');
      expect(result.lastName).toBe('Иванов');
    });

    it('should validate Яндекс ID token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'yandex_id',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        domain: 'company.yandex.ru',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('petrov.petr@yandex.ru');
      expect(result.firstName).toBe('Петр');
      expect(result.lastName).toBe('Петров');
    });

    it('should validate VK ID token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'vk_id',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('sidorov.sergey@vk.team');
      expect(result.firstName).toBe('Сергей');
      expect(result.lastName).toBe('Сидоров');
    });

    it('should validate Сбер ID token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'sber_id',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        issuerUrl: 'https://sberid.sberbank.ru',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('kozlov.konstantin@sberbank.ru');
      expect(result.firstName).toBe('Константин');
      expect(result.lastName).toBe('Козлов');
    });

    it('should validate MyTeam token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'my_team',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        issuerUrl: 'https://myteam.mail.ru',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('volkov.vladimir@myteam.mail.ru');
      expect(result.firstName).toBe('Владимир');
      expect(result.lastName).toBe('Волков');
    });

    it('should validate Astra Linux AD token successfully', async () => {
      const config: SSOConfiguration = {
        provider: 'astra_linux_ad',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        issuerUrl: 'https://ad.company.astra',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const result = await service.validateRussianSSOToken('valid-token', config);

      expect(result).toBeDefined();
      expect(result.email).toBe('morozov.mikhail@company.astra');
      expect(result.firstName).toBe('Михаил');
      expect(result.lastName).toBe('Морозов');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const config: SSOConfiguration = {
        provider: 'gosuslugi',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        organizationId: 'test-org',
        certPath: '/path/to/cert',
        keyPath: '/path/to/key',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      await expect(service.validateRussianSSOToken('invalid', config)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      const config: SSOConfiguration = {
        provider: 'unknown_provider' as any,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      await expect(service.validateRussianSSOToken('valid-token', config)).rejects.toThrow(BadRequestException);
    });
  });

  describe('fetchUsersFromRussianProvider', () => {
    it('should fetch users from Госуслуги', async () => {
      const config: SSOConfiguration = {
        provider: 'gosuslugi',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        organizationId: 'test-org',
        certPath: '/path/to/cert',
        keyPath: '/path/to/key',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const users = await service.fetchUsersFromRussianProvider(config);

      expect(users).toBeDefined();
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].email).toContain('@company.ru');
    });

    it('should fetch users from Яндекс ID', async () => {
      const config: SSOConfiguration = {
        provider: 'yandex_id',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        domain: 'company.yandex.ru',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const users = await service.fetchUsersFromRussianProvider(config);

      expect(users).toBeDefined();
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].email).toContain('@company.yandex');
    });

    it('should return empty array for unknown provider', async () => {
      const config: SSOConfiguration = {
        provider: 'unknown_provider' as any,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost/callback',
        scopes: ['openid', 'profile'],
      };

      const users = await service.fetchUsersFromRussianProvider(config);

      expect(users).toEqual([]);
    });
  });

  describe('Russian SSO providers coverage', () => {
    const providers = ['gosuslugi', 'yandex_id', 'vk_id', 'sber_id', 'my_team', 'astra_linux_ad'];

    providers.forEach(provider => {
      it(`should handle ${provider} provider`, async () => {
        const config: SSOConfiguration = {
          provider: provider as any,
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost/callback',
          scopes: ['openid', 'profile'],
          ...(provider === 'gosuslugi' && {
            organizationId: 'test-org',
            certPath: '/path/to/cert',
            keyPath: '/path/to/key',
          }),
          ...(provider === 'yandex_id' && { domain: 'company.yandex.ru' }),
          ...(['sber_id', 'my_team', 'astra_linux_ad'].includes(provider) && {
            issuerUrl: `https://${provider}.example.com`,
          }),
        };

        const result = await service.validateRussianSSOToken('valid-token', config);
        expect(result).toBeDefined();
        expect(result.email).toBeDefined();
        expect(result.firstName).toBeDefined();
        expect(result.lastName).toBeDefined();
      });
    });
  });
});
