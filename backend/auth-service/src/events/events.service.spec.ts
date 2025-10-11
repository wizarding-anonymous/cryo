import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { EventBusService } from './services/event-bus.service';
import { SecurityEventDto, NotificationEventDto, UserEventDto } from './dto';

describe('EventBusService', () => {
  let service: EventBusService;
  let mockSecurityQueue: any;
  let mockNotificationQueue: any;
  let mockUserQueue: any;

  beforeEach(async () => {
    mockSecurityQueue = {
      add: jest.fn().mockResolvedValue({}),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };

    mockNotificationQueue = {
      add: jest.fn().mockResolvedValue({}),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };

    mockUserQueue = {
      add: jest.fn().mockResolvedValue({}),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        {
          provide: getQueueToken('security-events'),
          useValue: mockSecurityQueue,
        },
        {
          provide: getQueueToken('notification-events'),
          useValue: mockNotificationQueue,
        },
        {
          provide: getQueueToken('user-events'),
          useValue: mockUserQueue,
        },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishSecurityEvent', () => {
    it('should publish security event to queue', async () => {
      const event = new SecurityEventDto({
        userId: 'user-123',
        type: 'login',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      });

      await service.publishSecurityEvent(event);

      expect(mockSecurityQueue.add).toHaveBeenCalledWith(
        'log-security-event',
        event,
        expect.objectContaining({
          priority: expect.any(Number),
          delay: 0,
        }),
      );
    });

    it('should not throw error if queue fails', async () => {
      mockSecurityQueue.add.mockRejectedValue(new Error('Queue error'));

      const event = new SecurityEventDto({
        userId: 'user-123',
        type: 'login',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      });

      await expect(service.publishSecurityEvent(event)).resolves.not.toThrow();
    });
  });

  describe('publishNotificationEvent', () => {
    it('should publish notification event to queue', async () => {
      const event = new NotificationEventDto({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'welcome',
        timestamp: new Date(),
      });

      await service.publishNotificationEvent(event);

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        event,
        expect.objectContaining({
          priority: expect.any(Number),
          delay: expect.any(Number),
        }),
      );
    });
  });

  describe('publishUserEvent', () => {
    it('should publish user event to queue', async () => {
      const event = new UserEventDto({
        userId: 'user-123',
        type: 'update_last_login',
        timestamp: new Date(),
      });

      await service.publishUserEvent(event);

      expect(mockUserQueue.add).toHaveBeenCalledWith(
        'update-user-data',
        event,
        expect.objectContaining({
          priority: expect.any(Number),
          delay: 0,
        }),
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        security: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        notification: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        user: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      });
    });
  });
});