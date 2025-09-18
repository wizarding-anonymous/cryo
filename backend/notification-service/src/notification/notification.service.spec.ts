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
import { Notification } from '../../entities/notification.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto';
import { NotificationChannel, NotificationType } from '../common/enums';

// Mock data
const mockUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const mockSettings: NotificationSettings = {
  id: 'settings-id',
  userId: mockUserId,
  inAppNotifications: true,
  emailNotifications: true,
  friendRequests: true,
  gameUpdates: true,
  achievements: true,
  purchases: true,
  systemNotifications: true,
  updatedAt: new Date(),
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
      jest
        .spyOn(cacheManager, 'get')
        .mockResolvedValue(JSON.stringify(mockSettings));
      const result = await service.getSettings(mockUserId);
      expect(result).toEqual(mockSettings);
      expect(settingsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return settings from DB and cache them if not in cache', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettings);
      const result = await service.getSettings(mockUserId);
      expect(result).toEqual(mockSettings);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `settings:${mockUserId}`,
        JSON.stringify(mockSettings),
        3600,
      );
    });

    it('should create default settings if none exist', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(settingsRepo, 'create')
        .mockReturnValue({ userId: mockUserId } as any);
      jest.spyOn(settingsRepo, 'save').mockResolvedValue(mockSettings);
      const result = await service.getSettings(mockUserId);
      expect(result).toEqual(mockSettings);
      expect(settingsRepo.create).toHaveBeenCalledWith({ userId: mockUserId });
      expect(cacheManager.set).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update settings and invalidate the cache', async () => {
      const dto = { emailNotifications: false };
      const newSettings = { ...mockSettings, ...dto };

      jest.spyOn(service, 'getSettings').mockResolvedValue(mockSettings);
      jest.spyOn(settingsRepo, 'save').mockResolvedValue(newSettings);
      jest.spyOn(cacheManager, 'del').mockResolvedValue();

      const result = await service.updateSettings(mockUserId, dto);

      expect(result).toEqual(newSettings);
      expect(settingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(`settings:${mockUserId}`);
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
    it('should call findAndCount with correct parameters', async () => {
      const query = { limit: 10, offset: 5 };
      jest.spyOn(notificationRepo, 'findAndCount').mockResolvedValue([[], 0]);
      await service.getUserNotifications(mockUserId, query);
      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 10,
        skip: 5,
        order: { createdAt: 'DESC' },
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
    const createDto: CreateNotificationDto = {
      userId: mockUserId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'Test',
      message: 'Test message',
    };

    it('should create a notification if settings allow', async () => {
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettings);
      jest.spyOn(notificationRepo, 'create').mockReturnValue(createDto as any);
      jest
        .spyOn(notificationRepo, 'save')
        .mockResolvedValue({ ...createDto, id: 'notif-id' } as any);

      const result = await service.createNotification(createDto);
      expect(result).toBeDefined();
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('should return null if type-specific setting is disabled', async () => {
      const disabledSettings = { ...mockSettings, friendRequests: false };
      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(disabledSettings);

      const result = await service.createNotification(createDto);
      expect(result).toBeNull();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('should call email service if channel is provided and enabled', async () => {
      const dtoWithEmail = {
        ...createDto,
        channels: [NotificationChannel.EMAIL],
      };
      const emailServiceSpy = jest.spyOn(emailService, 'sendNotificationEmail');
      const httpServiceSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of({ data: { email: 'test@test.com' } } as any));
      jest.spyOn(configService, 'get').mockReturnValue('http://user-service');

      jest.spyOn(settingsRepo, 'findOne').mockResolvedValue(mockSettings);
      jest
        .spyOn(notificationRepo, 'create')
        .mockReturnValue(dtoWithEmail as any);
      jest
        .spyOn(notificationRepo, 'save')
        .mockResolvedValue({ ...dtoWithEmail, id: 'notif-id' } as any);

      await service.createNotification(dtoWithEmail);

      expect(httpServiceSpy).toHaveBeenCalled();
      expect(emailServiceSpy).toHaveBeenCalled();
    });
  });
});
