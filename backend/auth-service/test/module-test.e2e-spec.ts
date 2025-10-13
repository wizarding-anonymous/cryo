import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { UserServiceClient } from '../src/common/http-client/user-service.client';
import { SecurityServiceClient } from '../src/common/http-client/security-service.client';
import { NotificationServiceClient } from '../src/common/http-client/notification-service.client';
import { createUserServiceClientMock, createSecurityServiceClientMock, createNotificationServiceClientMock } from '../src/test/mocks';

describe('Module Test', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    try {
      module = await Test.createTestingModule({
        providers: [
          UserServiceClient,
          SecurityServiceClient,
          NotificationServiceClient,
        ],
      })
      .overrideProvider(UserServiceClient)
      .useValue(createUserServiceClientMock())
      .overrideProvider(SecurityServiceClient)
      .useValue(createSecurityServiceClientMock())
      .overrideProvider(NotificationServiceClient)
      .useValue(createNotificationServiceClientMock())
      .compile();

      app = module.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Module compilation error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
    expect(app).toBeDefined();
    
    // Отладочная информация
    console.log('Module providers:', module['container']?.['modules']?.size);
    console.log('Available providers:', Object.keys(module['container']?.['globalModules'] || {}));
  });

  it('should provide UserServiceClient', () => {
    const userServiceClient = module.get(UserServiceClient);
    expect(userServiceClient).toBeDefined();
  });

  it('should provide SecurityServiceClient', () => {
    const securityServiceClient = module.get(SecurityServiceClient);
    expect(securityServiceClient).toBeDefined();
  });

  it('should provide NotificationServiceClient', () => {
    const notificationServiceClient = module.get(NotificationServiceClient);
    expect(notificationServiceClient).toBeDefined();
  });
});