import { UserEventProcessor } from './user-event.processor';
import { UserEventDto } from '../dto';
import { UserServiceClient } from '../../common/http-client/user-service.client';

describe('UserEventProcessor', () => {
  let processor: UserEventProcessor;
  let userServiceClient: jest.Mocked<UserServiceClient>;

  beforeEach(() => {
    userServiceClient = {
      updateLastLogin: jest.fn(),
      updateProfile: jest.fn(),
      updateAccountStatus: jest.fn(),
    } as any;

    processor = new UserEventProcessor(userServiceClient);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleUserEvent', () => {
    it('should process update_last_login event successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'update_last_login',
          data: { 
            lastLoginAt: new Date(),
            ipAddress: '192.168.1.1',
            userAgent: 'Test Browser'
          },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).resolves.not.toThrow();
    });

    it('should process profile_update event successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'profile_update',
          data: { 
            name: 'Updated Name',
            preferences: { theme: 'dark' }
          },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).resolves.not.toThrow();
    });

    it('should process account_status_change event successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'account_status_change',
          data: { 
            status: 'active',
            reason: 'Account verified',
            changedBy: 'admin'
          },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).resolves.not.toThrow();
    });

    it('should validate user event data', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: '',
          type: 'update_last_login',
          data: {},
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('User event missing userId');
    });

    it('should reject invalid user event types', async () => {
      const mockJob = {
        id: 'job-123',
        data: {
          userId: 'user-123',
          type: 'invalid_type',
          data: {},
          timestamp: new Date(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('Invalid user event type');
    });

    it('should validate update_last_login event data', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'update_last_login',
          data: {}, // Missing lastLoginAt
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('update_last_login event missing lastLoginAt');
    });

    it('should validate profile_update event data', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'profile_update',
          data: {}, // Empty data
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('profile_update event missing update data');
    });

    it('should validate account_status_change event data', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'account_status_change',
          data: {}, // Missing status
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('account_status_change event missing status');
    });

    it('should reject invalid account status', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'account_status_change',
          data: { status: 'invalid_status' },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('Invalid account status');
    });

    it('should filter profile update fields for security', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'profile_update',
          data: { 
            name: 'Valid Name',
            password: 'should_be_filtered', // Not allowed
            adminFlag: true, // Not allowed
            preferences: { theme: 'dark' } // Allowed
          },
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleUserEvent(mockJob)).resolves.not.toThrow();
    });

    it('should handle processing errors and store failed events on final attempt', async () => {
      const mockJob = {
        id: 'job-123',
        data: new UserEventDto({
          userId: 'user-123',
          type: 'update_last_login',
          data: { lastLoginAt: new Date() },
          timestamp: new Date(),
        }),
        attemptsMade: 2, // Final attempt (3rd attempt, 0-indexed)
        opts: { attempts: 3 },
      } as any;

      // Spy on the private method to make it throw
      const processSpy = jest.spyOn(processor as any, 'processLastLoginUpdate')
        .mockRejectedValue(new Error('Processing error'));

      await expect(processor.handleUserEvent(mockJob)).rejects.toThrow('Processing error');

      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('event lifecycle hooks', () => {
    it('should handle onActive event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'update_last_login', userId: 'user-123' },
      } as any;

      expect(() => processor.onActive(mockJob)).not.toThrow();
    });

    it('should handle onCompleted event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'update_last_login', userId: 'user-123' },
      } as any;

      expect(() => processor.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'update_last_login', userId: 'user-123' },
      } as any;
      const error = new Error('Test error');

      expect(() => processor.onFailed(mockJob, error)).not.toThrow();
    });
  });
});