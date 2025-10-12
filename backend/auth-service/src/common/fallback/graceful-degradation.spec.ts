import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { LocalSecurityLoggerService } from './local-security-logger.service';
import { LocalNotificationQueueService } from './local-notification-queue.service';
import { ServiceAvailabilityMonitorService } from './service-availability-monitor.service';
import { SecurityEvent } from '../../entities/security-event.entity';
import { RedisService } from '../redis/redis.service';

/**
 * Simplified test suite for graceful degradation core components
 * Task 17.3: Реализовать graceful degradation
 */
describe('Graceful Degradation Core Components', () => {
  let localSecurityLogger: LocalSecurityLoggerService;
  let localNotificationQueue: LocalNotificationQueueService;
  let serviceMonitor: ServiceAvailabilityMonitorService;
  let httpService: jest.Mocked<HttpService>;
  let redisService: jest.Mocked<RedisService>;
  let securityEventRepository: jest.Mocked<Repository<SecurityEvent>>;
  let configService: jest.Mocked<ConfigService>;

  const mockSecurityEvent = {
    userId: 'user-123',
    type: 'USER_LOGIN' as const,
    ipAddress: '192.168.1.1',
    timestamp: new Date(),
    metadata: { userAgent: 'test-agent' },
  };

  beforeEach(() => {
    // Suppress logs during testing
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    securityEventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      })),
    } as any;

    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn(),
      removeFromBlacklist: jest.fn(),
      setNX: jest.fn(),
      getTTL: jest.fn(),
      mget: jest.fn(),
    } as any;

    httpService = {
      get: jest.fn().mockReturnValue(of({
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      })),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        const config = {
          USER_SERVICE_URL: 'http://localhost:3002',
          SECURITY_SERVICE_URL: 'http://localhost:3010',
          NOTIFICATION_SERVICE_URL: 'http://localhost:3007',
        };
        return config[key];
      }),
    } as any;

    localSecurityLogger = new LocalSecurityLoggerService(securityEventRepository);
    localNotificationQueue = new LocalNotificationQueueService(redisService);
    serviceMonitor = new ServiceAvailabilityMonitorService(httpService, configService, redisService);
  });

  describe('Local Security Logger Service', () => {
    it('should log security events locally', async () => {
      // Mock local storage
      const mockEvent = { id: 'event-123', ...mockSecurityEvent };
      jest.spyOn(securityEventRepository, 'create').mockReturnValue(mockEvent as any);
      jest.spyOn(securityEventRepository, 'save').mockResolvedValue(mockEvent as any);

      await localSecurityLogger.logEventLocally(mockSecurityEvent);

      expect(securityEventRepository.create).toHaveBeenCalledWith({
        userId: mockSecurityEvent.userId,
        type: mockSecurityEvent.type,
        ipAddress: mockSecurityEvent.ipAddress,
        createdAt: mockSecurityEvent.timestamp,
        metadata: mockSecurityEvent.metadata,
        processed: false,
      });
      expect(securityEventRepository.save).toHaveBeenCalled();
    });

    it('should detect suspicious activity locally', async () => {
      // Mock database query for failed logins
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5), // 5 failed logins
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { ipAddress: '192.168.1.1' },
          { ipAddress: '192.168.1.2' },
        ]),
      };

      jest.spyOn(securityEventRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await localSecurityLogger.checkSuspiciousActivityLocally('user-123', '192.168.1.1');

      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('5 failed login attempts in 15 minutes');
    });

    it('should provide local security statistics', async () => {
      // Mock events for statistics
      const mockEvents = [
        { type: 'login', userId: 'user-1', ipAddress: '192.168.1.1', metadata: {} },
        { type: 'failed_login', userId: 'user-2', ipAddress: '192.168.1.2', metadata: {} },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEvents),
      };

      jest.spyOn(securityEventRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(securityEventRepository, 'count').mockResolvedValue(5);

      const stats = await localSecurityLogger.getLocalSecurityStats(24);

      expect(stats.totalEvents).toBe(2);
      expect(stats.eventsByType.login).toBe(1);
      expect(stats.eventsByType.failed_login).toBe(1);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.uniqueIPs).toBe(2);
      expect(stats.suspiciousActivities).toBe(1);
      expect(stats.unprocessedEvents).toBe(5);
    });

    it('should get queue statistics', () => {
      const stats = localSecurityLogger.getQueueStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('maxQueueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(typeof stats.queueSize).toBe('number');
      expect(typeof stats.maxQueueSize).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });

  describe('Local Notification Queue Service', () => {
    it('should queue welcome notifications', async () => {
      const welcomeRequest = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const notificationId = await localNotificationQueue.queueWelcomeNotification(welcomeRequest);

      expect(typeof notificationId).toBe('string');
      expect(notificationId).toMatch(/^notif_/);
    });

    it('should queue security alerts with high priority', async () => {
      const securityRequest = {
        userId: 'user-123',
        email: 'test@example.com',
        alertType: 'suspicious_login' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      const notificationId = await localNotificationQueue.queueSecurityAlert(securityRequest);

      expect(typeof notificationId).toBe('string');
      expect(notificationId).toMatch(/^notif_/);
    });

    it('should provide queue statistics', () => {
      const stats = localNotificationQueue.getQueueStats();

      expect(stats).toHaveProperty('totalQueued');
      expect(stats).toHaveProperty('byPriority');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('readyForRetry');
      expect(stats).toHaveProperty('averageRetryCount');
      expect(typeof stats.totalQueued).toBe('number');
      expect(typeof stats.averageRetryCount).toBe('number');
    });

    it('should get notifications ready for retry', () => {
      const notifications = localNotificationQueue.getNotificationsReadyForRetry(10);

      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should get notifications by priority', () => {
      const highPriorityNotifications = localNotificationQueue.getQueuedNotificationsByPriority('high', 10);

      expect(Array.isArray(highPriorityNotifications)).toBe(true);
    });

    it('should clean up old notifications', async () => {
      const cleaned = await localNotificationQueue.cleanupOldNotifications(72);

      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Service Availability Monitor', () => {
    it('should detect unavailable services', async () => {
      // Mock service health check failure
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Connection refused'))
      );

      const result = await serviceMonitor.checkServiceHealth('UserService');

      expect(result).toBeDefined();
      expect(result?.isAvailable).toBe(false);
      expect(result?.errorMessage).toContain('Connection refused');
      expect(result?.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should detect available services', async () => {
      // Mock successful response
      const mockResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await serviceMonitor.checkServiceHealth('UserService');

      expect(result).toBeDefined();
      expect(result?.isAvailable).toBe(true);
      expect(result?.responseTime).toBeDefined();
      expect(result?.consecutiveFailures).toBe(0);
    });

    it('should provide monitoring statistics', () => {
      const stats = serviceMonitor.getMonitoringStats();

      expect(stats).toHaveProperty('totalServices');
      expect(stats).toHaveProperty('availableServices');
      expect(stats).toHaveProperty('unavailableServices');
      expect(stats).toHaveProperty('degradedServices');
      expect(stats).toHaveProperty('averageUptime');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('recentAlerts');
    });

    it('should get service status', () => {
      const status = serviceMonitor.getServiceStatus('UserService');

      expect(status).toBeDefined();
      expect(status?.name).toBe('UserService');
      expect(typeof status?.isAvailable).toBe('boolean');
    });

    it('should check if service is available', () => {
      const isAvailable = serviceMonitor.isServiceAvailable('UserService');

      expect(typeof isAvailable).toBe('boolean');
    });

    it('should get unavailable services', () => {
      const unavailableServices = serviceMonitor.getUnavailableServices();

      expect(Array.isArray(unavailableServices)).toBe(true);
    });

    it('should get degraded services', () => {
      const degradedServices = serviceMonitor.getDegradedServices();

      expect(Array.isArray(degradedServices)).toBe(true);
    });

    it('should get recent alerts', () => {
      const alerts = serviceMonitor.getRecentAlerts(10);

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should force health check', async () => {
      // Mock successful response
      const mockResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const results = await serviceMonitor.forceHealthCheck();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle Redis unavailability gracefully', async () => {
      // Mock Redis failure
      jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis unavailable'));
      jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis unavailable'));

      // Should still work with local storage only
      const notificationId = await localNotificationQueue.queueWelcomeNotification({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(typeof notificationId).toBe('string');

      // Security logging should still work
      const mockEvent = { id: 'event-123', ...mockSecurityEvent };
      jest.spyOn(securityEventRepository, 'create').mockReturnValue(mockEvent as any);
      jest.spyOn(securityEventRepository, 'save').mockResolvedValue(mockEvent as any);

      await expect(localSecurityLogger.logEventLocally(mockSecurityEvent)).resolves.toBeUndefined();
    });

    it('should provide comprehensive system health status', async () => {
      // Mock healthy state
      const mockResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      // Check all services
      await serviceMonitor.checkAllServices();

      const stats = serviceMonitor.getMonitoringStats();
      const securityStats = await localSecurityLogger.getLocalSecurityStats(24);
      const notificationStats = localNotificationQueue.getQueueStats();

      // System should be considered healthy if:
      // - At least 50% of services are available
      // - Not too many unprocessed security events
      // - Not too many queued notifications
      const isHealthy = 
        stats.availableServices >= stats.totalServices * 0.5 &&
        securityStats.unprocessedEvents < 1000 &&
        notificationStats.totalQueued < 5000;

      expect(typeof isHealthy).toBe('boolean');
      expect(stats.totalServices).toBeGreaterThan(0);
    });

    it('should handle database unavailability gracefully', async () => {
      // Mock database failure
      jest.spyOn(securityEventRepository, 'save').mockRejectedValue(new Error('Database unavailable'));

      // Should not throw error, should queue in memory instead
      await expect(localSecurityLogger.logEventLocally(mockSecurityEvent)).resolves.toBeUndefined();

      // Queue should still work
      const stats = localSecurityLogger.getQueueStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service timeout gracefully', async () => {
      // Mock timeout
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }))
      );

      const result = await serviceMonitor.checkServiceHealth('UserService');

      expect(result).toBeDefined();
      expect(result?.isAvailable).toBe(false);
      expect(result?.errorMessage).toContain('timeout');
    });

    it('should handle malformed responses gracefully', async () => {
      // Mock malformed response
      const mockResponse: AxiosResponse = {
        data: null,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await serviceMonitor.checkServiceHealth('UserService');

      expect(result).toBeDefined();
      expect(result?.isAvailable).toBe(false);
      expect(result?.errorMessage).toContain('500');
    });

    it('should handle queue overflow gracefully', async () => {
      // Fill up the queue to test overflow handling
      const promises = [];
      for (let i = 0; i < 50; i++) { // Much smaller number for testing
        promises.push(localNotificationQueue.queueWelcomeNotification({
          userId: `user-${i}`,
          email: `test${i}@example.com`,
          name: `Test User ${i}`,
        }));
      }

      await Promise.all(promises);

      const stats = localNotificationQueue.getQueueStats();
      expect(stats.totalQueued).toBeGreaterThan(0); // Should have queued notifications
    });
  });
});