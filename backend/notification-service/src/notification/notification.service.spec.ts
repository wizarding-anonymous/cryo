import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { Notification } from '../entities/notification.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../common/enums';
import { RedisCacheService } from '../cache/redis-cache.service';

const mockUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const mockDate = new Date('2024-01-01T10:00:00.000Z');

const mockSettingsEntity: NotificationSettings = {
  id: 'settings-id',
  userId: mockUserId,
  inAppNotifications: true,
  emailNotifications: true,
  friendRequests: true,
  gameUpdates: true,
  achievements: true,
  purchases: true,
  systemNotifications: true,
  updatedAt: mockDate,
};

const mockSettingsDto = {
  id: mockSettingsEntity.id,
  userId: mockSettingsEntity.userId,
  inAppNotifications: mockSettingsEntity.inAppNotifications,
  emailNotifications: mockSettingsEntity.emailNotifications,
  friendRequests: mockSettingsEntity.friendRequests,
  gameUpdates: mockSettingsEntity.gameUpdates,
  achievements: mockSettingsEntity.achievements,
  purchases: mockSettingsEntity.purchases,
  systemNotifications: mockSettingsEntity.systemNotifications,
  updatedAt: mockSettingsEntity.updatedAt,
};

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Repository<Notification>;
  let settingsRepo: Repository<NotificationSettings>;
  let cacheManager: Cache;
  let emailService: EmailService;
  let redisCacheService: RedisCacheService;

  beforeEach(async () => {
    // Create fresh mock instances for each test
    const mockNotificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };

    const mockSettingsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockEmailService = {
      sendNotificationEmail: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const mockRedisCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      isRedisConnected: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(NotificationSettings),
          useValue: mockSettingsRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisCacheService,
          useValue: mockRedisCacheService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    settingsRepo = module.get<Repository<NotificationSettings>>(
      getRepositoryToken(NotificationSettings),
    );
    cacheManager = module.get(CACHE_MANAGER);
    emailService = module.get<EmailService>(EmailService);
    redisCacheService = module.get<RedisCacheService>(RedisCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return settings from cache if available', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(mockSettingsDto);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(settingsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return settings from DB and cache them if not in cache', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(redisCacheService, 'get').mockResolvedValue(null);
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(cacheManager.set as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        mockSettingsDto,
        3600,
      );
    });

    it('should return settings from Redis cache if memory cache misses but Redis hits', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(true);
      jest.spyOn(redisCacheService, 'get').mockResolvedValue(mockSettingsDto);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(settingsRepo.findOne).not.toHaveBeenCalled();
      expect(cacheManager.set as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        mockSettingsDto,
        3600,
      );
    });

    it('should create default settings if user has none', async () => {
      const createdSettings = { ...mockSettingsEntity };
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(settingsRepo, 'create').mockReturnValue(createdSettings);
      jest.spyOn(settingsRepo, 'save').mockResolvedValue(createdSettings);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(settingsRepo.create as jest.Mock).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update settings, refresh cache and return DTO', async () => {
      const dto = { emailNotifications: false };
      const updatedEntity = { ...mockSettingsEntity, ...dto };
      const expectedDto = { ...mockSettingsDto, ...dto };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest.spyOn(settingsRepo, 'save').mockResolvedValue(updatedEntity);

      const result = await service.updateSettings(mockUserId, dto);

      expect(result).toEqual(expectedDto);
      expect(settingsRepo.save as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(cacheManager.set as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        expectedDto,
        3600,
      );
    });

    it('should update both memory and Redis cache when Redis is connected', async () => {
      const dto = { emailNotifications: false };
      const updatedEntity = { ...mockSettingsEntity, ...dto };
      const expectedDto = { ...mockSettingsDto, ...dto };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest.spyOn(settingsRepo, 'save').mockResolvedValue(updatedEntity);
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(true);

      const result = await service.updateSettings(mockUserId, dto);

      expect(result).toEqual(expectedDto);
      expect(cacheManager.set as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        expectedDto,
        3600,
      );
      expect(redisCacheService.set as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        expectedDto,
        3600,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      jest
        .spyOn(notificationRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.markAsRead('notif-id', mockUserId);

      expect(notificationRepo.update as jest.Mock).toHaveBeenCalledWith(
        { id: 'notif-id', userId: mockUserId },
        { isRead: true },
      );
    });

    it('should throw NotFoundException if notification does not exist or user is not owner', async () => {
      jest
        .spyOn(notificationRepo, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(service.markAsRead('notif-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should call repository with correct parameters and return DTOs', async () => {
      const query = { limit: 10, offset: 5 };
      const notificationEntity: Notification = {
        id: 'notif-id',
        userId: mockUserId,
        type: NotificationType.PURCHASE,
        title: 'Title',
        message: 'Message',
        isRead: false,
        priority: NotificationPriority.HIGH,
        metadata: { amount: 100 },
        channels: [NotificationChannel.IN_APP],
        createdAt: mockDate,
        updatedAt: mockDate,
        expiresAt: undefined,
      };

      jest
        .spyOn(notificationRepo, 'findAndCount')
        .mockResolvedValue([[notificationEntity], 1]);

      const result = await service.getUserNotifications(mockUserId, query);

      expect(notificationRepo.findAndCount as jest.Mock).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 10,
        skip: 5,
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({
        data: [
          {
            id: 'notif-id',
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Title',
            message: 'Message',
            isRead: false,
            priority: NotificationPriority.HIGH,
            metadata: { amount: 100 },
            channels: [NotificationChannel.IN_APP],
            createdAt: mockDate,
          },
        ],
        total: 1,
        limit: 10,
        offset: 5,
      });
    });

    it('should include filters in where clause', async () => {
      const query = { type: NotificationType.PURCHASE, isRead: false };
      jest.spyOn(notificationRepo, 'findAndCount').mockResolvedValue([[], 0]);

      await service.getUserNotifications(mockUserId, query);

      expect(notificationRepo.findAndCount as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            isRead: false,
          },
        }),
      );
    });
  });

  describe('createNotification', () => {
    const baseDto: CreateNotificationDto = {
      userId: mockUserId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'Test',
      message: 'Test message',
    };

    it('should create a notification and return DTO if settings allow', async () => {
      const createdEntity: Partial<Notification> = {
        ...baseDto,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        isRead: false,
      };
      const savedEntity: Notification = {
        ...(createdEntity as Notification),
        id: 'notif-id',
        createdAt: mockDate,
        updatedAt: mockDate,
        metadata: undefined,
        expiresAt: undefined,
      };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest
        .spyOn(notificationRepo, 'create')
        .mockReturnValue(createdEntity as Notification);
      jest.spyOn(notificationRepo, 'save').mockResolvedValue(savedEntity);

      const result = await service.createNotification(baseDto);

      expect(result).toEqual({
        id: 'notif-id',
        userId: mockUserId,
        type: baseDto.type,
        title: baseDto.title,
        message: baseDto.message,
        isRead: false,
        priority: NotificationPriority.NORMAL,
        metadata: undefined,
        channels: [NotificationChannel.IN_APP],
        createdAt: mockDate,
      });
    });

    it('should return null if type-specific setting is disabled', async () => {
      const disabledSettings = { ...mockSettingsEntity, friendRequests: false };
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(disabledSettings);

      const result = await service.createNotification(baseDto);

      expect(result).toBeNull();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('should call email service if EMAIL channel is requested and enabled', async () => {
      // Create a completely fresh service instance for this test
      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: getRepositoryToken(Notification),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findAndCount: jest.fn(),
              update: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(NotificationSettings),
            useValue: {
              findOne: jest.fn(),
              create: jest.fn(),
              save: jest.fn(),
            },
          },
          {
            provide: CACHE_MANAGER,
            useValue: {
              get: jest.fn(),
              set: jest.fn(),
              del: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendNotificationEmail: jest.fn(),
            },
          },
          {
            provide: HttpService,
            useValue: {
              get: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(),
            },
          },
          {
            provide: RedisCacheService,
            useValue: {
              get: jest.fn(),
              set: jest.fn(),
              del: jest.fn(),
              keys: jest.fn().mockResolvedValue([]),
              isRedisConnected: jest.fn().mockReturnValue(false),
            },
          },
        ],
      }).compile();

      const freshService =
        freshModule.get<NotificationService>(NotificationService);
      const freshNotificationRepo = freshModule.get<Repository<Notification>>(
        getRepositoryToken(Notification),
      );
      const freshSettingsRepo = freshModule.get<
        Repository<NotificationSettings>
      >(getRepositoryToken(NotificationSettings));
      const freshEmailService = freshModule.get<EmailService>(EmailService);
      const freshHttpService = freshModule.get<HttpService>(HttpService);
      const freshConfigService = freshModule.get<ConfigService>(ConfigService);

      const dtoWithEmail = {
        ...baseDto,
        channels: [NotificationChannel.EMAIL],
      };
      const createdEntity: Partial<Notification> = {
        ...dtoWithEmail,
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL,
        isRead: false,
      };
      const savedEntity: Notification = {
        ...(createdEntity as Notification),
        id: 'notif-id',
        createdAt: mockDate,
        updatedAt: mockDate,
        metadata: undefined,
        expiresAt: undefined,
      };

      // Setup mocks for fresh service
      (freshSettingsRepo.findOne as jest.Mock).mockResolvedValue(
        mockSettingsEntity,
      );
      (freshNotificationRepo.create as jest.Mock).mockImplementation((dto) => {
        return { ...createdEntity, channels: dto.channels } as Notification;
      });
      (freshNotificationRepo.save as jest.Mock).mockImplementation(
        (notification) => {
          return Promise.resolve({
            ...savedEntity,
            channels: notification.channels,
          });
        },
      );

      (freshConfigService.get as jest.Mock).mockImplementation(
        (key: string) => {
          if (key === 'USER_SERVICE_URL') return 'http://user-service';
          return undefined;
        },
      );

      (freshHttpService.get as jest.Mock).mockReturnValue(
        of({ data: { email: 'test@test.com' } } as any),
      );
      (freshEmailService.sendNotificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await freshService.createNotification(dtoWithEmail);

      expect(
        freshEmailService.sendNotificationEmail as jest.Mock,
      ).toHaveBeenCalledWith(
        'test@test.com',
        expect.objectContaining({
          id: 'notif-id',
          userId: mockUserId,
          type: NotificationType.FRIEND_REQUEST,
          title: 'Test',
          message: 'Test message',
          channels: [NotificationChannel.EMAIL],
        }),
      );
    });

    it('should not call email service if USER_SERVICE_URL is not configured', async () => {
      const dtoWithEmail = {
        ...baseDto,
        channels: [NotificationChannel.EMAIL],
      };
      const createdEntity: Partial<Notification> = {
        ...dtoWithEmail,
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL,
        isRead: false,
      };
      const savedEntity: Notification = {
        ...(createdEntity as Notification),
        id: 'notif-id',
        createdAt: mockDate,
        updatedAt: mockDate,
        metadata: undefined,
        expiresAt: undefined,
      };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest
        .spyOn(notificationRepo, 'create')
        .mockReturnValue(createdEntity as Notification);
      jest.spyOn(notificationRepo, 'save').mockResolvedValue(savedEntity);

      // ConfigService returns undefined for USER_SERVICE_URL (default behavior)
      const emailSpy = jest.spyOn(emailService, 'sendNotificationEmail');

      await service.createNotification(dtoWithEmail);

      expect(emailSpy).not.toHaveBeenCalled();
    });
  });

  describe('clearSettingsCache', () => {
    it('should clear cache from both memory and Redis', async () => {
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(true);

      await service.clearSettingsCache(mockUserId);

      expect(cacheManager.del as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
      );
      expect(redisCacheService.del as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
      );
    });

    it('should only clear memory cache when Redis is not connected', async () => {
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(false);

      await service.clearSettingsCache(mockUserId);

      expect(cacheManager.del as jest.Mock).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
      );
      expect(redisCacheService.del as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache stats with Redis keys when connected', async () => {
      const mockKeys = ['settings:user1', 'settings:user2'];
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(true);
      jest.spyOn(redisCacheService, 'keys').mockResolvedValue(mockKeys);

      const result = await service.getCacheStats();

      expect(result).toEqual({
        redisConnected: true,
        cacheKeys: mockKeys,
      });
    });

    it('should return basic stats when Redis is not connected', async () => {
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(false);

      const result = await service.getCacheStats();

      expect(result).toEqual({
        redisConnected: false,
      });
    });

    it('should handle Redis errors gracefully', async () => {
      jest.spyOn(redisCacheService, 'isRedisConnected').mockReturnValue(true);
      jest
        .spyOn(redisCacheService, 'keys')
        .mockRejectedValue(new Error('Redis error'));

      const result = await service.getCacheStats();

      expect(result).toEqual({
        redisConnected: true,
      });
    });
  });

  describe('createBulkNotifications', () => {
    it('should create notifications for multiple users', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const template = {
        type: NotificationType.GAME_UPDATE,
        title: 'Game Update',
        message: 'New update available',
      };

      // Mock createNotification to return success for all users
      jest.spyOn(service, 'createNotification').mockResolvedValue({
        id: 'notif-id',
        userId: 'user1',
        type: NotificationType.GAME_UPDATE,
        title: 'Game Update',
        message: 'New update available',
        isRead: false,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.IN_APP],
        createdAt: mockDate,
      });

      const result = await service.createBulkNotifications(userIds, template);

      expect(result).toEqual({ created: 3, skipped: 0 });
      expect(service.createNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const template = {
        type: NotificationType.GAME_UPDATE,
        title: 'Game Update',
        message: 'New update available',
      };

      // Mock createNotification to return success for some, null for others, and error for one
      jest
        .spyOn(service, 'createNotification')
        .mockResolvedValueOnce({
          id: 'notif-id',
          userId: 'user1',
          type: NotificationType.GAME_UPDATE,
          title: 'Game Update',
          message: 'New update available',
          isRead: false,
          priority: NotificationPriority.NORMAL,
          channels: [NotificationChannel.IN_APP],
          createdAt: mockDate,
        })
        .mockResolvedValueOnce(null) // User has notifications disabled
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await service.createBulkNotifications(userIds, template);

      expect(result).toEqual({ created: 1, skipped: 2 });
    });

    it('should process users in batches', async () => {
      // Create 100 users to test batching
      const userIds = Array.from({ length: 100 }, (_, i) => `user${i}`);
      const template = {
        type: NotificationType.SYSTEM,
        title: 'System Message',
        message: 'Important announcement',
      };

      jest.spyOn(service, 'createNotification').mockResolvedValue({
        id: 'notif-id',
        userId: 'user1',
        type: NotificationType.SYSTEM,
        title: 'System Message',
        message: 'Important announcement',
        isRead: false,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.IN_APP],
        createdAt: mockDate,
      });

      const result = await service.createBulkNotifications(userIds, template);

      expect(result).toEqual({ created: 100, skipped: 0 });
      expect(service.createNotification).toHaveBeenCalledTimes(100);
    });
  });

  describe('getUserNotificationStats', () => {
    it('should return notification statistics for a user', async () => {
      const mockStats = [
        { type: NotificationType.PURCHASE, count: '5' },
        { type: NotificationType.ACHIEVEMENT, count: '3' },
      ];

      // Mock the count method properly
      const mockCount = jest.fn()
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4); // unread
      
      Object.defineProperty(notificationRepo, 'count', {
        value: mockCount,
        writable: true,
      });

      jest.spyOn(notificationRepo, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      } as any);

      const result = await service.getUserNotificationStats(mockUserId);

      expect(result.total).toBe(10);
      expect(result.unread).toBe(4);
      expect(result.byType[NotificationType.PURCHASE]).toBe(5);
      expect(result.byType[NotificationType.ACHIEVEMENT]).toBe(3);
      expect(result.byType[NotificationType.FRIEND_REQUEST]).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection errors gracefully', async () => {
      jest.spyOn(settingsRepo, 'findOne').mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getSettings(mockUserId)).rejects.toThrow('Database connection failed');
    });

    it('should handle cache errors gracefully', async () => {
      // Mock cache to reject with error
      const mockGet = jest.fn().mockRejectedValue(new Error('Cache error'));
      Object.defineProperty(cacheManager, 'get', {
        value: mockGet,
        writable: true,
      });
      
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(settingsRepo.findOne).toHaveBeenCalled();
    });

    it('should handle HTTP service errors when fetching user data for email', async () => {
      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          {
            provide: getRepositoryToken(Notification),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              findAndCount: jest.fn(),
              update: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(NotificationSettings),
            useValue: {
              findOne: jest.fn(),
              create: jest.fn(),
              save: jest.fn(),
            },
          },
          {
            provide: CACHE_MANAGER,
            useValue: {
              get: jest.fn(),
              set: jest.fn(),
              del: jest.fn(),
            },
          },
          {
            provide: EmailService,
            useValue: {
              sendNotificationEmail: jest.fn(),
            },
          },
          {
            provide: HttpService,
            useValue: {
              get: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(),
            },
          },
          {
            provide: RedisCacheService,
            useValue: {
              get: jest.fn(),
              set: jest.fn(),
              del: jest.fn(),
              keys: jest.fn().mockResolvedValue([]),
              isRedisConnected: jest.fn().mockReturnValue(false),
            },
          },
        ],
      }).compile();

      const freshService = freshModule.get<NotificationService>(NotificationService);
      const freshNotificationRepo = freshModule.get<Repository<Notification>>(
        getRepositoryToken(Notification),
      );
      const freshSettingsRepo = freshModule.get<Repository<NotificationSettings>>(
        getRepositoryToken(NotificationSettings),
      );
      const freshEmailService = freshModule.get<EmailService>(EmailService);
      const freshHttpService = freshModule.get<HttpService>(HttpService);
      const freshConfigService = freshModule.get<ConfigService>(ConfigService);

      const dtoWithEmail = {
        userId: mockUserId,
        type: NotificationType.PURCHASE,
        title: 'Test',
        message: 'Test message',
        channels: [NotificationChannel.EMAIL],
      };

      const savedEntity: Notification = {
        id: 'notif-id',
        userId: mockUserId,
        type: NotificationType.PURCHASE,
        title: 'Test',
        message: 'Test message',
        isRead: false,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.EMAIL],
        createdAt: mockDate,
        updatedAt: mockDate,
        metadata: undefined,
        expiresAt: undefined,
      };

      (freshSettingsRepo.findOne as jest.Mock).mockResolvedValue(mockSettingsEntity);
      (freshNotificationRepo.create as jest.Mock).mockReturnValue(savedEntity);
      (freshNotificationRepo.save as jest.Mock).mockResolvedValue(savedEntity);
      (freshConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'USER_SERVICE_URL') return 'http://user-service';
        return undefined;
      });

      // Mock HTTP service to throw error
      (freshHttpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('User service unavailable'))
      );

      // Should not throw error, just log and continue
      const result = await freshService.createNotification(dtoWithEmail);

      expect(result).toBeDefined();
      expect(freshEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should handle notification creation with expired notifications', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const dtoWithExpiry: CreateNotificationDto = {
        userId: mockUserId,
        type: NotificationType.SYSTEM,
        title: 'Expired notification',
        message: 'This should be expired',
        expiresAt: expiredDate,
      };

      const createdEntity: Partial<Notification> = {
        ...dtoWithExpiry,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        isRead: false,
      };
      const savedEntity: Notification = {
        ...(createdEntity as Notification),
        id: 'notif-id',
        createdAt: mockDate,
        updatedAt: mockDate,
        metadata: undefined,
      };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest.spyOn(notificationRepo, 'create').mockReturnValue(createdEntity as Notification);
      jest.spyOn(notificationRepo, 'save').mockResolvedValue(savedEntity);

      const result = await service.createNotification(dtoWithExpiry);

      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-id');
    });

    it('should handle notifications with metadata', async () => {
      const dtoWithMetadata: CreateNotificationDto = {
        userId: mockUserId,
        type: NotificationType.PURCHASE,
        title: 'Purchase completed',
        message: 'Your purchase was successful',
        metadata: {
          orderId: 'order-123',
          amount: 29.99,
          currency: 'RUB',
        },
      };

      const createdEntity: Partial<Notification> = {
        ...dtoWithMetadata,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        isRead: false,
      };
      const savedEntity: Notification = {
        ...(createdEntity as Notification),
        id: 'notif-id',
        createdAt: mockDate,
        updatedAt: mockDate,
        expiresAt: undefined,
      };

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);
      jest.spyOn(notificationRepo, 'create').mockReturnValue(createdEntity as Notification);
      jest.spyOn(notificationRepo, 'save').mockResolvedValue(savedEntity);

      const result = await service.createNotification(dtoWithMetadata);

      expect(result).toBeDefined();
      expect(result?.metadata).toEqual({
        orderId: 'order-123',
        amount: 29.99,
        currency: 'RUB',
      });
    });
  });
});
