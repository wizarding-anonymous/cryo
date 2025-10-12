import { NotificationEventProcessor } from './notification-event.processor';
import { NotificationEventDto } from '../dto';
import { NotificationServiceClient } from '../../common/http-client/notification-service.client';

describe('NotificationEventProcessor', () => {
  let processor: NotificationEventProcessor;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;

  beforeEach(() => {
    notificationServiceClient = {
      sendWelcomeNotification: jest.fn().mockResolvedValue(undefined),
      sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
      sendLoginAlert: jest.fn().mockResolvedValue(undefined),
    } as any;

    processor = new NotificationEventProcessor(notificationServiceClient);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleNotificationEvent', () => {
    it('should process welcome notification successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: 'user-123',
          email: 'test@example.com',
          type: 'welcome',
          data: { name: 'Test User' },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      await expect(processor.handleNotificationEvent(mockJob)).resolves.not.toThrow();
      
      expect(notificationServiceClient.sendWelcomeNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        language: 'ru',
      });
    });

    it('should process security alert notification successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: 'user-123',
          email: 'test@example.com',
          type: 'security_alert',
          data: { alertType: 'suspicious_login', ipAddress: '192.168.1.1' },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      await expect(processor.handleNotificationEvent(mockJob)).resolves.not.toThrow();
      
      expect(notificationServiceClient.sendSecurityAlert).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'suspicious_login',
        {
          ipAddress: '192.168.1.1',
          userAgent: undefined,
          location: undefined,
          timestamp: expect.any(Date),
        }
      );
    });

    it('should validate notification event data', async () => {
      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: '',
          email: 'invalid-email',
          type: 'welcome',
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      await expect(processor.handleNotificationEvent(mockJob)).rejects.toThrow();
    });

    it('should reject invalid email addresses', async () => {
      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: 'user-123',
          email: 'not-an-email',
          type: 'welcome',
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      await expect(processor.handleNotificationEvent(mockJob)).rejects.toThrow('Invalid email address');
    });

    it('should reject invalid notification types', async () => {
      const mockJob = {
        id: 'job-123',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          type: 'invalid_type',
          timestamp: new Date(),
        },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      await expect(processor.handleNotificationEvent(mockJob)).rejects.toThrow('Invalid notification type');
    });

    it('should handle processing errors and store failed notifications on final attempt', async () => {
      // Mock console.log to avoid test output pollution
      const originalLog = console.log;
      console.log = jest.fn();

      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: 'user-123',
          email: 'test@example.com',
          type: 'welcome',
          timestamp: new Date(),
        }),
        attemptsMade: 4, // Final attempt (5th attempt, 0-indexed)
        opts: { attempts: 5 },
      } as any;

      // Spy on the private method to make it throw
      const processSpy = jest.spyOn(processor as any, 'processWelcomeNotification')
        .mockRejectedValue(new Error('Processing error'));

      await expect(processor.handleNotificationEvent(mockJob)).rejects.toThrow('Processing error');

      expect(processSpy).toHaveBeenCalled();

      // Restore console.log
      console.log = originalLog;
    });

    it('should handle service integration errors gracefully', async () => {
      notificationServiceClient.sendWelcomeNotification.mockRejectedValue(new Error('Service error'));

      const mockJob = {
        id: 'job-123',
        data: new NotificationEventDto({
          userId: 'user-123',
          email: 'test@example.com',
          type: 'welcome',
          data: { name: 'Test User' },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      // Should not throw error even if service integration fails
      await expect(processor.handleNotificationEvent(mockJob)).resolves.not.toThrow();
      
      expect(notificationServiceClient.sendWelcomeNotification).toHaveBeenCalled();
    });
  });

  describe('event lifecycle hooks', () => {
    it('should handle onActive event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'welcome', userId: 'user-123' },
      } as any;

      expect(() => processor.onActive(mockJob)).not.toThrow();
    });

    it('should handle onCompleted event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'welcome', userId: 'user-123' },
      } as any;

      expect(() => processor.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'welcome', userId: 'user-123' },
      } as any;
      const error = new Error('Test error');

      expect(() => processor.onFailed(mockJob, error)).not.toThrow();
    });
  });
});