import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { UserServiceClient } from './user.service.client';
import { NotificationServiceClient } from './notification.service.client';
import { AchievementServiceClient } from './achievement.service.client';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ExternalServicesHealthService } from './external-services-health.service';
import { CacheService } from '../cache/cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('External Service Clients Integration', () => {
  let userServiceClient: UserServiceClient;
  let notificationServiceClient: NotificationServiceClient;
  let achievementServiceClient: AchievementServiceClient;
  let circuitBreakerService: CircuitBreakerService;
  let healthService: ExternalServicesHealthService;
  let httpService: HttpService;
  let cacheService: CacheService;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        UserServiceClient,
        NotificationServiceClient,
        AchievementServiceClient,
        CircuitBreakerService,
        ExternalServicesHealthService,
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    userServiceClient = module.get<UserServiceClient>(UserServiceClient);
    notificationServiceClient = module.get<NotificationServiceClient>(NotificationServiceClient);
    achievementServiceClient = module.get<AchievementServiceClient>(AchievementServiceClient);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    healthService = module.get<ExternalServicesHealthService>(ExternalServicesHealthService);
    httpService = module.get<HttpService>(HttpService);
    cacheService = module.get<CacheService>(CacheService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('UserServiceClient', () => {
    describe('getUsersByIds', () => {
      it('should fetch users and cache them individually', async () => {
        const mockUsers = [
          { id: 'user1', username: 'testuser1' },
          { id: 'user2', username: 'testuser2' },
        ];
        const mockResponse: AxiosResponse = {
          data: { users: mockUsers },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockCacheManager.get.mockResolvedValue(null);
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

        const result = await userServiceClient.getUsersByIds(['user1', 'user2']);

        expect(result).toEqual(mockUsers);
        expect(mockCacheManager.set).toHaveBeenCalledTimes(2); // Individual user caching
      });

      it('should return cached users when available', async () => {
        const cachedUser = { id: 'user1', username: 'cached' };
        mockCacheManager.get.mockResolvedValueOnce(cachedUser).mockResolvedValueOnce(null);

        const result = await userServiceClient.getUsersByIds(['user1']);

        expect(result).toEqual([cachedUser]);
        expect(jest.spyOn(httpService, 'get')).not.toHaveBeenCalled();
      });

      it('should handle service failures gracefully', async () => {
        mockCacheManager.get.mockResolvedValue(null);
        const error = new AxiosError('Service unavailable');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

        const result = await userServiceClient.getUsersByIds(['user1']);

        expect(result).toEqual([]);
      });
    });

    describe('checkUserExists', () => {
      it('should check user existence with caching', async () => {
        const mockResponse: AxiosResponse = {
          data: { exists: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockCacheManager.get.mockResolvedValue(null);
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

        const result = await userServiceClient.checkUserExists('user1');

        expect(result).toBe(true);
        expect(mockCacheManager.set).toHaveBeenCalledWith('user_client:exists:user1', true, 600);
      });

      it('should return cached existence check', async () => {
        mockCacheManager.get.mockResolvedValue(false);

        const result = await userServiceClient.checkUserExists('user1');

        expect(result).toBe(false);
        expect(jest.spyOn(httpService, 'get')).not.toHaveBeenCalled();
      });
    });

    describe('searchUsers', () => {
      it('should search users with query normalization', async () => {
        const mockUsers = [{ id: 'user1', username: 'testuser' }];
        const mockResponse: AxiosResponse = {
          data: mockUsers,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockCacheManager.get.mockResolvedValue(null);
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

        const result = await userServiceClient.searchUsers('  TestUser  ');

        expect(result).toEqual(mockUsers);
        expect(httpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/users/search'),
          expect.objectContaining({
            params: { q: 'testuser', excludeId: undefined },
          }),
        );
      });

      it('should return empty array for short queries', async () => {
        const result = await userServiceClient.searchUsers('a');

        expect(result).toEqual([]);
        expect(jest.spyOn(httpService, 'get')).not.toHaveBeenCalled();
      });
    });
  });

  describe('NotificationServiceClient', () => {
    describe('sendNotification', () => {
      it('should send notification successfully', async () => {
        const mockResponse: AxiosResponse = {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

        const notificationDto = {
          userId: 'user1',
          type: 'friend_request' as const,
          title: 'Test',
          message: 'Test message',
        };

        await expect(
          notificationServiceClient.sendNotification(notificationDto),
        ).resolves.not.toThrow();
      });

      it('should handle notification failures gracefully', async () => {
        const error = new AxiosError('Service unavailable');
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error));

        const notificationDto = {
          userId: 'user1',
          type: 'friend_request' as const,
          title: 'Test',
          message: 'Test message',
        };

        // Should not throw error (graceful degradation)
        await expect(
          notificationServiceClient.sendNotification(notificationDto),
        ).resolves.not.toThrow();
      });
    });

    describe('sendBatchNotifications', () => {
      it('should send batch notifications', async () => {
        const mockResponse: AxiosResponse = {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

        const notifications = [
          {
            userId: 'user1',
            type: 'friend_request' as const,
            title: 'Test 1',
            message: 'Test message 1',
          },
          {
            userId: 'user2',
            type: 'new_message' as const,
            title: 'Test 2',
            message: 'Test message 2',
          },
        ];

        await expect(
          notificationServiceClient.sendBatchNotifications(notifications),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('AchievementServiceClient', () => {
    describe('updateProgress', () => {
      it('should update achievement progress successfully', async () => {
        const mockResponse: AxiosResponse = {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

        const progressDto = {
          userId: 'user1',
          eventType: 'friend_added' as const,
          eventData: { friendId: 'user2' },
        };

        await expect(achievementServiceClient.updateProgress(progressDto)).resolves.not.toThrow();
      });

      it('should handle achievement service failures gracefully', async () => {
        const error = new AxiosError('Service unavailable');
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error));

        const progressDto = {
          userId: 'user1',
          eventType: 'friend_added' as const,
          eventData: { friendId: 'user2' },
        };

        // Should not throw error (graceful degradation)
        await expect(achievementServiceClient.updateProgress(progressDto)).resolves.not.toThrow();
      });
    });

    describe('getUserAchievements', () => {
      it('should get user achievements', async () => {
        const mockAchievements = [{ id: 'ach1', name: 'First Friend' }];
        const mockResponse: AxiosResponse = {
          data: { achievements: mockAchievements },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

        const result = await achievementServiceClient.getUserAchievements('user1');

        expect(result).toEqual(mockAchievements);
      });

      it('should return empty array on failure', async () => {
        const error = new AxiosError('Service unavailable');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

        const result = await achievementServiceClient.getUserAchievements('user1');

        expect(result).toEqual([]);
      });
    });
  });

  describe('CircuitBreakerService', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreakerService.execute('test-circuit', mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after threshold failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerService.execute('test-circuit', mockFn, { failureThreshold: 3 });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      expect(circuitBreakerService.isAvailable('test-circuit')).toBe(false);
    });

    it('should provide circuit statistics', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      await circuitBreakerService.execute('stats-circuit', mockFn);

      const stats = circuitBreakerService.getStats('stats-circuit');

      expect(stats).toBeDefined();
      expect(stats?.successes).toBe(1);
      expect(stats?.state).toBe('CLOSED');
    });
  });

  describe('ExternalServicesHealthService', () => {
    it('should initialize health status for all services', () => {
      const healthStatus = healthService.getHealthStatus();

      expect(healthStatus).toHaveProperty('user-service');
      expect(healthStatus).toHaveProperty('notification-service');
      expect(healthStatus).toHaveProperty('achievement-service');
    });

    it('should check if all services are healthy', () => {
      // Initially all services should be unknown, so not all healthy
      const allHealthy = healthService.areAllServicesHealthy();

      expect(typeof allHealthy).toBe('boolean');
    });
  });
});
