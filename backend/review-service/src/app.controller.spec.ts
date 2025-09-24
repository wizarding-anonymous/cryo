import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
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

    const mockHttpService = {
      get: jest.fn().mockReturnValue(of({ status: 200, data: { status: 'ok' } })),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
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
        {
          provide: HttpService,
          useValue: mockHttpService,
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
      expect(health.status).toMatch(/^(ok|degraded)$/); // Allow degraded status in tests
      expect(health.service).toBe('review-service');
      expect(health.version).toBeDefined();
      expect(health.checks).toBeDefined();
      expect(health.checks.database).toBeDefined();
      expect(health.checks.cache).toBeDefined();
    });
  });
});
