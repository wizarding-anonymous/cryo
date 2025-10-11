import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEventProcessor } from './security-event.processor';
import { SecurityEvent } from '../../entities/security-event.entity';
import { SecurityEventDto } from '../dto';

describe('SecurityEventProcessor', () => {
  let processor: SecurityEventProcessor;
  let mockRepository: Partial<Repository<SecurityEvent>>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockImplementation((data) => ({ id: 'test-id', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityEventProcessor,
        {
          provide: getRepositoryToken(SecurityEvent),
          useValue: mockRepository,
        },
      ],
    }).compile();

    processor = module.get<SecurityEventProcessor>(SecurityEventProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleSecurityEvent', () => {
    it('should process security event successfully', async () => {
      const mockJob = {
        id: 'job-123',
        data: new SecurityEventDto({
          userId: 'user-123',
          type: 'login',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser',
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleSecurityEvent(mockJob)).resolves.not.toThrow();
      
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'login',
        ipAddress: '192.168.1.1',
        metadata: {
          userAgent: 'Test Browser',
        },
        processed: false,
      });
      
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.save = jest.fn().mockRejectedValue(new Error('Database error'));

      const mockJob = {
        id: 'job-123',
        data: new SecurityEventDto({
          userId: 'user-123',
          type: 'login',
          ipAddress: '192.168.1.1',
          timestamp: new Date(),
        }),
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleSecurityEvent(mockJob)).rejects.toThrow('Database error');
    });

    it('should store failed event on final attempt', async () => {
      mockRepository.save = jest.fn()
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'failed-event-id' });

      const mockJob = {
        id: 'job-123',
        data: new SecurityEventDto({
          userId: 'user-123',
          type: 'login',
          ipAddress: '192.168.1.1',
          timestamp: new Date(),
        }),
        attemptsMade: 2, // Final attempt (3rd attempt, 0-indexed)
        opts: { attempts: 3 },
      } as any;

      await expect(processor.handleSecurityEvent(mockJob)).rejects.toThrow('Database error');
      
      // Should call save twice: once for normal event (fails), once for failed event
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('event lifecycle hooks', () => {
    it('should handle onActive event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'login', userId: 'user-123' },
      } as any;

      expect(() => processor.onActive(mockJob)).not.toThrow();
    });

    it('should handle onCompleted event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'login', userId: 'user-123' },
      } as any;

      expect(() => processor.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = {
        id: 'job-123',
        data: { type: 'login', userId: 'user-123' },
      } as any;
      const error = new Error('Test error');

      expect(() => processor.onFailed(mockJob, error)).not.toThrow();
    });
  });
});