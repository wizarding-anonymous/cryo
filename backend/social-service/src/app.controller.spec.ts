import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Social Service is running!"', () => {
      expect(appController.getHello()).toBe('Social Service is running!');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const health = appController.getHealth();
      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('service', 'social-service');
      expect(health).toHaveProperty('version', '1.0.0');
    });
  });
});
