import { EventBusService } from './services/event-bus.service';
import { SecurityEventDto, NotificationEventDto, UserEventDto } from './dto';

describe('Events Integration', () => {
  let eventBusService: EventBusService;
  let mockSecurityQueue: any;
  let mockNotificationQueue: any;
  let mockUserQueue: any;

  beforeAll(() => {
    // Mock queues for integration testing
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

    const mockAsyncOperations = {
      executeImmediate: jest.fn().mockImplementation(async (fn) => await fn()),
      executeParallel: jest.fn().mockImplementation(async (operations) => {
        for (const op of operations) {
          await op();
        }
      }),
      executeBatch: jest.fn().mockImplementation(async (operations) => {
        for (const op of operations) {
          await op();
        }
      }),
      registerOperation: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      shutdown: jest.fn(),
    };

    const mockMetricsService = {
      recordEventMetric: jest.fn(),
      getPerformanceSummary: jest.fn().mockReturnValue({}),
      getHealthStatus: jest.fn().mockReturnValue({
        status: 'healthy',
        issues: [],
        metrics: {},
      }),
    };

    eventBusService = new EventBusService(
      mockSecurityQueue,
      mockNotificationQueue,
      mockUserQueue,
      mockAsyncOperations as any,
      mockMetricsService as any
    );
  });

  it('should be defined', () => {
    expect(eventBusService).toBeDefined();
  });

  it('should publish and process security event', async () => {
    const event = new SecurityEventDto({
      userId: 'test-user-123',
      type: 'login',
      ipAddress: '192.168.1.100',
      userAgent: 'Test Browser',
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishSecurityEvent(event)).resolves.not.toThrow();
  });

  it('should publish and process notification event', async () => {
    const event = new NotificationEventDto({
      userId: 'test-user-123',
      email: 'test@example.com',
      type: 'welcome',
      data: { name: 'Test User' },
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishNotificationEvent(event)).resolves.not.toThrow();
  });

  it('should publish and process user event', async () => {
    const event = new UserEventDto({
      userId: 'test-user-123',
      type: 'update_last_login',
      data: { lastLoginAt: new Date() },
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishUserEvent(event)).resolves.not.toThrow();
  });

  it('should get queue statistics', async () => {
    const stats = await eventBusService.getQueueStats();
    
    expect(stats).toHaveProperty('security');
    expect(stats).toHaveProperty('notification');
    expect(stats).toHaveProperty('user');
    
    expect(typeof stats.security.waiting).toBe('number');
    expect(typeof stats.notification.waiting).toBe('number');
    expect(typeof stats.user.waiting).toBe('number');
  });
});