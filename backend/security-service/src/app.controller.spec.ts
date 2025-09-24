import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController (unit)', () => {
  let controller: AppController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should return ok on health', () => {
    const res = controller.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('security-service');
  });
});
