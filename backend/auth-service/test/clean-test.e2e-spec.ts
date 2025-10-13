import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

// Простые моки без импорта реальных классов
const mockUserServiceClient = {
  findByEmail: jest.fn(),
  createUser: jest.fn(),
  findById: jest.fn(),
};

describe('Clean Test (without setup)', () => {
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
});