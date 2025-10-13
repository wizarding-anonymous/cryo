import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

// Простые моки без импорта реальных классов
const mockUserServiceClient = {
  findByEmail: jest.fn(),
  createUser: jest.fn(),
  findById: jest.fn(),
};

const mockSecurityServiceClient = {
  logSecurityEvent: jest.fn(),
  checkSuspiciousActivity: jest.fn(),
};

const mockNotificationServiceClient = {
  sendWelcomeNotification: jest.fn(),
  sendLoginAlert: jest.fn(),
};

describe('Simple Test', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    try {
      module = await Test.createTestingModule({
        providers: [
          {
            provide: 'USER_SERVICE_CLIENT',
            useValue: mockUserServiceClient,
          },
          {
            provide: 'SECURITY_SERVICE_CLIENT',
            useValue: mockSecurityServiceClient,
          },
          {
            provide: 'NOTIFICATION_SERVICE_CLIENT',
            useValue: mockNotificationServiceClient,
          },
        ],
      }).compile();

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
  });

  it('should provide USER_SERVICE_CLIENT', () => {
    const userServiceClient = module.get('USER_SERVICE_CLIENT');
    expect(userServiceClient).toBeDefined();
    expect(userServiceClient.findByEmail).toBeDefined();
  });

  it('should provide SECURITY_SERVICE_CLIENT', () => {
    const securityServiceClient = module.get('SECURITY_SERVICE_CLIENT');
    expect(securityServiceClient).toBeDefined();
    expect(securityServiceClient.logSecurityEvent).toBeDefined();
  });

  it('should provide NOTIFICATION_SERVICE_CLIENT', () => {
    const notificationServiceClient = module.get('NOTIFICATION_SERVICE_CLIENT');
    expect(notificationServiceClient).toBeDefined();
    expect(notificationServiceClient.sendWelcomeNotification).toBeDefined();
  });
});