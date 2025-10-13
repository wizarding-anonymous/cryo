import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Mock services for external dependencies
import {
  createUserServiceClientMock,
  createSecurityServiceClientMock,
  createNotificationServiceClientMock,
} from './mocks';

import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';

/**
 * Минимальный тестовый модуль для проверки DI
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          JWT_SECRET: 'test-jwt-secret-key-for-e2e-tests',
          JWT_EXPIRES_IN: '1h',
          NODE_ENV: 'test',
          IS_E2E_TEST: 'true',
        }),
      ],
    }),
    JwtModule.register({
      secret: 'test-jwt-secret-key-for-e2e-tests',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    // Mock external service clients
    {
      provide: UserServiceClient,
      useValue: createUserServiceClientMock(),
    },
    {
      provide: SecurityServiceClient,
      useValue: createSecurityServiceClientMock(),
    },
    {
      provide: NotificationServiceClient,
      useValue: createNotificationServiceClientMock(),
    },
  ],
  exports: [
    UserServiceClient,
    SecurityServiceClient,
    NotificationServiceClient,
  ],
})
export class MinimalE2ETestModule {}