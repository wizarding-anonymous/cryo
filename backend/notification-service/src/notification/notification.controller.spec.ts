import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateNotificationDto } from './dto';
import { NotificationType } from '../common/enums';

const mockUserId = 'user-123';
const mockRequest = { user: { id: mockUserId } };

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            getUserNotifications: jest.fn().mockResolvedValue({}),
            getSettings: jest.fn().mockResolvedValue({}),
            updateSettings: jest.fn().mockResolvedValue({}),
            markAsRead: jest.fn().mockResolvedValue(undefined),
            createNotification: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: mockUserId };
          return true;
        },
      })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserNotifications', () => {
    it('should call service with correct params if user is authorized', async () => {
      await controller.getUserNotifications(mockRequest, mockUserId, {});
      expect(service.getUserNotifications).toHaveBeenCalledWith(mockUserId, {});
    });

    it('should throw ForbiddenException if userId does not match token', async () => {
      const differentUserId = 'wrong-user-id';
      await expect(
        controller.getUserNotifications(mockRequest, differentUserId, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSettings', () => {
    it('should call service with correct params if user is authorized', async () => {
      await controller.getSettings(mockRequest, mockUserId);
      expect(service.getSettings).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException if userId does not match token', async () => {
      const differentUserId = 'wrong-user-id';
      await expect(
        controller.getSettings(mockRequest, differentUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateSettings', () => {
    it('should call service with correct params if user is authorized', async () => {
      const dto = { emailNotifications: false };
      await controller.updateSettings(mockRequest, mockUserId, dto);
      expect(service.updateSettings).toHaveBeenCalledWith(mockUserId, dto);
    });

    it('should throw ForbiddenException if userId does not match token', async () => {
      const differentUserId = 'wrong-user-id';
      await expect(
        controller.updateSettings(mockRequest, differentUserId, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAsRead', () => {
    it('should call service with correct params', async () => {
      const notificationId = 'notif-abc';
      await controller.markAsRead(mockRequest, notificationId);
      expect(service.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUserId,
      );
    });
  });

  describe('Webhooks', () => {
    it('should call createNotification for payment webhook', async () => {
      const dto: CreateNotificationDto = {
        userId: 'user-payment-123',
        type: NotificationType.PURCHASE,
        title: 'Payment successful',
        message: 'Your payment was successful.',
      };
      await controller.handlePaymentWebhook(dto);
      expect(service.createNotification).toHaveBeenCalledWith(dto);
    });

    it('should call createNotification for social webhook', async () => {
      const dto: CreateNotificationDto = {
        userId: 'user-social-123',
        type: NotificationType.FRIEND_REQUEST,
        title: 'New friend request',
        message: 'You have a new friend request.',
      };
      await controller.handleSocialWebhook(dto);
      expect(service.createNotification).toHaveBeenCalledWith(dto);
    });
  });
});
