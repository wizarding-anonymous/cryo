import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Review } from './entities/review.entity';
import { GameRating } from './entities/game-rating.entity';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    const mockCacheManager = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('test'),
      del: jest.fn().mockResolvedValue(true),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(GameRating),
          useValue: mockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service info', () => {
      expect(appController.getHello()).toBe('Review Service API - Ready to serve game reviews and ratings!');
    });

    it('should return health status', async () => {
      const health = await appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.service).toBe('review-service');
      expect(health.version).toBe('1.0.0');
    });
  });
});
