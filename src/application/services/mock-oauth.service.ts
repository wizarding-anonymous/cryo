import { Injectable, Logger } from '@nestjs/common';

interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

@Injectable()
export class MockOAuthService {
  private readonly logger = new Logger(MockOAuthService.name);

  async authenticate(provider: 'vk' | 'yandex', code: string): Promise<OAuthUserData> {
    this.logger.log(`🔐 Mock authentication for ${provider} with code: ${code}`);

    if (provider === 'vk') {
      return {
        provider: 'vk',
        providerId: 'vk_12345',
        email: 'mock.vk.user@example.com',
        firstName: 'Иван',
        lastName: 'ВКонтакте',
      };
    }

    if (provider === 'yandex') {
        return {
          provider: 'yandex',
          providerId: 'yandex_67890',
          email: 'mock.yandex.user@example.com',
          firstName: 'Петр',
          lastName: 'Яндексов',
        };
      }
  }
}
