import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cache } from 'cache-manager';
import { of } from 'rxjs';
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
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
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
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettingsEntity);

      const result = await service.getSettings(mockUserId);

      expect(result).toEqual(mockSettingsDto);
      expect(cacheManager.set).toHaveBeenCalledWith(
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
      expect(settingsRepo.create).toHaveBeenCalledWith({ userId: mockUserId });
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
      expect(settingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
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

      expect(notificationRepo.update).toHaveBeenCalledWith(
        { id: 'notif-id', userId: mockUserId },
        { isRead: true },
      );
    });

    it('should throw NotFoundException if notification does not exist or user is not owner', async () => {
      jest
        .spyOn(notificationRepo, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.markAsRead('notif-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
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

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
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

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith(
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
      jest.spyOn(configService, 'get').mockReturnValue('http://user-service');
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of({ data: { email: 'test@test.com' } } as any));
      const emailSpy = jest.spyOn(
        emailService,
        'sendNotificationEmail',
      );

      await service.createNotification(dtoWithEmail);

      expect(emailSpy).toHaveBeenCalledWith('test@test.com', savedEntity);
    });
  });
});
