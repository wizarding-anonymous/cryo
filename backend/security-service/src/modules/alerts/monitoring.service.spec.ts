import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { KAFKA_PRODUCER_SERVICE } from '../../kafka/kafka.constants';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { SecurityEventType } from '../../common/enums/security-event-type.enum';
import { SecurityAlertType } from '../../common/enums/security-alert-type.enum';
import { SecurityAlertSeverity } from '../../common/enums/security-alert-severity.enum';

const alertRepoMock = () => ({
  create: jest.fn((x) => ({ id: 'a1', createdAt: new Date(), ...x })),
  save: jest.fn(async (x) => x),
  find: jest.fn(async () => [{ id: 'a1', resolved: false }]),
  findOne: jest.fn(async () => ({ id: 'a1', resolved: false })),
  createQueryBuilder: jest.fn(() => {
    const qb: any = {
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getManyAndCount: jest.fn(async () => [[{ id: 'a1' }], 1]),
    };
    return qb;
  }),
});

const eventsRepoMock = () => ({
  createQueryBuilder: jest.fn(() => {
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      getMany: jest.fn(async () => [
        { id: 'e1', riskScore: 90, createdAt: new Date(), type: SecurityEventType.FAILED_LOGIN, ip: '192.168.1.1', data: {} },
        { id: 'e2', riskScore: 10, createdAt: new Date(), type: SecurityEventType.PURCHASE, ip: '192.168.1.2', data: { amount: 100 } },
      ]),
      getCount: jest.fn(async () => 6), // For failed login threshold testing
    };
    return qb;
  }),
});

describe('MonitoringService', () => {
  let service: MonitoringService;
  let alertsRepo: ReturnType<typeof alertRepoMock>;
  let eventsRepo: ReturnType<typeof eventsRepoMock>;
  let configService: ConfigService;

  beforeEach(async () => {
    alertsRepo = alertRepoMock();
    eventsRepo = eventsRepoMock();
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
        { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepo },
        { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
        { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn(), close: jest.fn() } },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: (d: any) => JSON.stringify(d),
            decrypt: (d: any) => JSON.parse(d || '{}'),
          },
        },
        { provide: MetricsService, useValue: { recordAlert: jest.fn(), setActiveAlerts: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(MonitoringService);
    configService = moduleRef.get(ConfigService);
  });

  it('creates and resolves alert', async () => {
    const created = await service.createAlert({ 
      type: SecurityAlertType.SUSPICIOUS_ACTIVITY, 
      severity: SecurityAlertSeverity.LOW 
    });
    expect(created).toBeDefined();
    await service.resolveAlert('a1');
    expect(alertsRepo.save).toHaveBeenCalled();
  });

  it('detects suspicious activity', async () => {
    const res = await service.detectSuspiciousActivity('u1');
    expect(typeof res.suspicious).toBe('boolean');
    expect(res.score).toBeGreaterThanOrEqual(0);
  });

  it('returns paginated alerts', async () => {
    const res = await service.getAlerts({ page: 1, pageSize: 10 });
    expect(res.total).toBe(1);
  });

  describe('Automatic Detection Rules', () => {
    it('should detect multiple failed logins and create alert', async () => {
      // Mock getCount to return value above threshold (5)
      const qb = eventsRepo.createQueryBuilder();
      qb.getCount = jest.fn().mockResolvedValue(6);

      await service.checkMultipleFailedLogins('user123', '192.168.1.1');

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityAlertSeverity.MEDIUM,
          userId: 'user123',
          ip: '192.168.1.1',
        })
      );
    });

    it('should not create alert for failed logins below threshold', async () => {
      // Override the default mock for this specific test
      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn(async () => []),
          getCount: jest.fn(async () => 3), // Below threshold of 5
        };
        return qb;
      });

      // Reset the mock to ensure clean state
      alertsRepo.create.mockClear();
      
      await service.checkMultipleFailedLogins('user123', '192.168.1.1');

      expect(alertsRepo.create).not.toHaveBeenCalled();
    });

    it('should detect unusual purchase - high amount', async () => {
      const qb = eventsRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([
        { data: { amount: 100 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 86400000) },
        { data: { amount: 150 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 172800000) },
      ]);

      await service.checkUnusualPurchase('user123', 15000, '192.168.1.1'); // High amount

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.UNUSUAL_PURCHASE,
          severity: SecurityAlertSeverity.HIGH,
          userId: 'user123',
          ip: '192.168.1.1',
        })
      );
    });

    it('should detect unusual purchase - amount much higher than average', async () => {
      const qb = eventsRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([
        { data: { amount: 100 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 86400000) },
        { data: { amount: 150 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 172800000) },
        { data: { amount: 120 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 259200000) },
      ]);

      // Average is ~123, purchasing 1000 (8x higher than average, above 5x threshold)
      // Also 2x higher than max (150), so it will be HIGH severity
      await service.checkUnusualPurchase('user123', 1000, '192.168.1.1');

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.UNUSUAL_PURCHASE,
          severity: SecurityAlertSeverity.HIGH, // Changed from MEDIUM to HIGH
          userId: 'user123',
          ip: '192.168.1.1',
        })
      );
    });

    it('should detect unusual purchase - new IP address', async () => {
      const qb = eventsRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([
        { data: { amount: 100 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 86400000) },
        { data: { amount: 150 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 172800000) },
      ]);

      await service.checkUnusualPurchase('user123', 200, '10.0.0.1'); // Different IP

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.UNUSUAL_PURCHASE,
          userId: 'user123',
          ip: '10.0.0.1',
        })
      );
    });

    it('should not create alert for normal purchase', async () => {
      const qb = eventsRepo.createQueryBuilder();
      qb.getMany = jest.fn().mockResolvedValue([
        { data: { amount: 100 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 86400000) },
        { data: { amount: 150 }, ip: '192.168.1.1', createdAt: new Date(Date.now() - 172800000) },
      ]);

      const createSpy = jest.spyOn(service, 'createAlert');
      await service.checkUnusualPurchase('user123', 120, '192.168.1.1'); // Normal amount, same IP

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should run automatic detection for failed login event', async () => {
      const checkFailedLoginsSpy = jest.spyOn(service, 'checkMultipleFailedLogins').mockResolvedValue();
      
      const event: SecurityEvent = {
        id: 'event1',
        type: SecurityEventType.FAILED_LOGIN,
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        data: {},
        riskScore: 50,
        createdAt: new Date(),
      };

      await service.runAutomaticDetection(event);

      expect(checkFailedLoginsSpy).toHaveBeenCalledWith('user123', '192.168.1.1');
    });

    it('should run automatic detection for purchase event', async () => {
      const checkUnusualPurchaseSpy = jest.spyOn(service, 'checkUnusualPurchase').mockResolvedValue();
      
      const event: SecurityEvent = {
        id: 'event1',
        type: SecurityEventType.PURCHASE,
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        data: { amount: 500 },
        riskScore: 30,
        createdAt: new Date(),
      };

      await service.runAutomaticDetection(event);

      expect(checkUnusualPurchaseSpy).toHaveBeenCalledWith('user123', 500, '192.168.1.1');
    });

    it('should create suspicious activity alert for high-risk user', async () => {
      const detectSuspiciousSpy = jest.spyOn(service, 'detectSuspiciousActivity')
        .mockResolvedValue({ suspicious: true, score: 85, reasons: ['High activity'] });
      
      const event: SecurityEvent = {
        id: 'event1',
        type: SecurityEventType.LOGIN,
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        data: {},
        riskScore: 30,
        createdAt: new Date(),
      };

      await service.runAutomaticDetection(event);

      expect(detectSuspiciousSpy).toHaveBeenCalledWith('user123');
      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
          severity: SecurityAlertSeverity.HIGH,
          userId: 'user123',
        })
      );
    });

    it('should handle errors in automatic detection gracefully', async () => {
      const detectSuspiciousSpy = jest.spyOn(service, 'detectSuspiciousActivity')
        .mockRejectedValue(new Error('Database error'));
      
      const event: SecurityEvent = {
        id: 'event1',
        type: SecurityEventType.LOGIN,
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        data: {},
        riskScore: 30,
        createdAt: new Date(),
      };

      // Should not throw error
      await expect(service.runAutomaticDetection(event)).resolves.not.toThrow();
    });
  });

  describe('analyzeUserBehavior', () => {
    it('should analyze user behavior patterns', async () => {
      const mockEvents = [
        { type: SecurityEventType.LOGIN, createdAt: new Date() },
        { type: SecurityEventType.LOGIN, createdAt: new Date(Date.now() - 3600000) },
        { type: SecurityEventType.PURCHASE, createdAt: new Date(Date.now() - 7200000) },
      ];
      
      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockResolvedValue(mockEvents),
        };
        return qb;
      });

      const analysis = await service.analyzeUserBehavior('user123');

      expect(analysis.userId).toBe('user123');
      expect(analysis.countsByType).toEqual({
        [SecurityEventType.LOGIN]: 2,
        [SecurityEventType.PURCHASE]: 1,
      });
      expect(analysis.lastActiveAt).toBeDefined();
    });

    it('should handle users with no activity', async () => {
      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockResolvedValue([]),
        };
        return qb;
      });

      const analysis = await service.analyzeUserBehavior('user123');

      expect(analysis.userId).toBe('user123');
      expect(analysis.countsByType).toEqual({});
      expect(analysis.lastActiveAt).toBeUndefined();
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect suspicious activity based on event count', async () => {
      const mockEvents = Array(25).fill(null).map((_, i) => ({
        id: `e${i}`,
        riskScore: 50,
        createdAt: new Date(Date.now() - i * 60000),
      }));

      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockResolvedValue(mockEvents),
        };
        return qb;
      });

      const result = await service.detectSuspiciousActivity('user123');

      expect(result.suspicious).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('high activity: 25 events in 10m');
    });

    it('should detect suspicious activity based on high-risk events', async () => {
      const mockEvents = [
        { id: 'e1', riskScore: 90, createdAt: new Date() },
        { id: 'e2', riskScore: 85, createdAt: new Date() },
      ];

      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockResolvedValue(mockEvents),
        };
        return qb;
      });

      const result = await service.detectSuspiciousActivity('user123');

      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('2 high-risk events (>=80)');
    });

    it('should not flag normal activity as suspicious', async () => {
      const mockEvents = [
        { id: 'e1', riskScore: 30, createdAt: new Date() },
        { id: 'e2', riskScore: 25, createdAt: new Date() },
      ];

      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockResolvedValue(mockEvents),
        };
        return qb;
      });

      const result = await service.detectSuspiciousActivity('user123');

      expect(result.suspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('Alert Management', () => {
    it('should emit Kafka event for high severity alerts', async () => {
      const kafkaClient = { emit: jest.fn(), close: jest.fn() };
      (service as any).kafkaClient = kafkaClient;

      await service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
        userId: 'user123',
        data: { test: 'data' },
      });

      expect(kafkaClient.emit).toHaveBeenCalledWith('security.alerts.created', expect.objectContaining({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
        userId: 'user123',
      }));
    });

    it('should not emit Kafka event for low severity alerts', async () => {
      const kafkaClient = { emit: jest.fn(), close: jest.fn() };
      (service as any).kafkaClient = kafkaClient;

      await service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.LOW,
        userId: 'user123',
        data: { test: 'data' },
      });

      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });

    it('should decrypt alert data when retrieving alerts', async () => {
      const mockAlerts = [
        { id: 'a1', data: '{"encrypted":"data"}', type: SecurityAlertType.SUSPICIOUS_ACTIVITY },
      ];
      alertsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          skip: jest.fn(() => qb),
          take: jest.fn(() => qb),
          getManyAndCount: jest.fn().mockResolvedValue([mockAlerts, 1]),
        };
        return qb;
      });

      const result = await service.getAlerts({});

      expect(result.data[0].data).toEqual({ encrypted: 'data' });
    });

    it('should filter alerts by query parameters', async () => {
      const query = {
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
        resolved: false,
        page: 2,
        pageSize: 25,
      };

      const result = await service.getAlerts(query);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(result.total).toBe(1);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get active alerts and update metrics', async () => {
      const mockAlerts = [
        { id: 'a1', resolved: false, data: '{}' },
        { id: 'a2', resolved: false, data: '{}' },
      ];
      alertsRepo.find.mockResolvedValue(mockAlerts);

      const alerts = await service.getActiveAlerts();

      expect(alerts).toHaveLength(2);
      expect((service as any).metrics?.setActiveAlerts).toHaveBeenCalledWith(2);
    });

    it('should resolve alert with timestamp and resolver', async () => {
      const mockAlert = { id: 'alert1', resolved: false, resolvedAt: null, resolvedBy: null } as any;
      alertsRepo.findOne.mockResolvedValue(mockAlert);

      await service.resolveAlert('alert1', 'admin123');

      expect(mockAlert.resolved).toBe(true);
      expect(mockAlert.resolvedAt).toBeInstanceOf(Date);
      expect(mockAlert.resolvedBy).toBe('admin123');
      expect(alertsRepo.save).toHaveBeenCalledWith(mockAlert);
    });

    it('should handle resolving non-existent alert', async () => {
      alertsRepo.findOne.mockResolvedValue(null as any);

      await service.resolveAlert('nonexistent');

      expect(alertsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Module Lifecycle', () => {
    it('should close Kafka client on module destroy', async () => {
      const kafkaClient = { emit: jest.fn(), close: jest.fn() };
      (service as any).kafkaClient = kafkaClient;

      await service.onModuleDestroy();

      expect(kafkaClient.close).toHaveBeenCalled();
    });

    it('should handle Kafka client close errors gracefully', async () => {
      const kafkaClient = { 
        emit: jest.fn(), 
        close: jest.fn().mockRejectedValue(new Error('Kafka close failed'))
      };
      (service as any).kafkaClient = kafkaClient;

      await expect(service.onModuleDestroy()).rejects.toThrow('Kafka close failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors in createAlert', async () => {
      alertsRepo.save.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle encryption errors in createAlert', async () => {
      const encryptionService = {
        encrypt: jest.fn().mockImplementation(() => {
          throw new Error('Encryption failed');
        }),
        decrypt: jest.fn(),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
          { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepo },
          { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
          { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn(), close: jest.fn() } },
          { provide: EncryptionService, useValue: encryptionService },
          { provide: MetricsService, useValue: { recordAlert: jest.fn(), setActiveAlerts: jest.fn() } },
        ],
      }).compile();

      const serviceWithBadEncryption = moduleRef.get(MonitoringService);

      await expect(serviceWithBadEncryption.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
        data: { test: 'data' },
      })).rejects.toThrow('Encryption failed');
    });

    it('should handle Kafka emit errors gracefully', async () => {
      const kafkaClient = { 
        emit: jest.fn().mockImplementation(() => {
          throw new Error('Kafka emit failed');
        }),
        close: jest.fn()
      };
      (service as any).kafkaClient = kafkaClient;

      // Should throw error when Kafka fails for HIGH severity alerts
      await expect(service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
      })).rejects.toThrow('Kafka emit failed');

      // But should still save the alert to database
      expect(alertsRepo.save).toHaveBeenCalled();
    });

    it('should handle database errors in getAlerts', async () => {
      alertsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          skip: jest.fn(() => qb),
          take: jest.fn(() => qb),
          getManyAndCount: jest.fn().mockRejectedValue(new Error('Database query failed')),
        };
        return qb;
      });

      await expect(service.getAlerts({})).rejects.toThrow('Database query failed');
    });

    it('should handle decryption errors in getAlerts', async () => {
      const encryptionService = {
        encrypt: jest.fn((data) => JSON.stringify(data)),
        decrypt: jest.fn().mockImplementation(() => {
          throw new Error('Decryption failed');
        }),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
          { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepo },
          { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
          { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn(), close: jest.fn() } },
          { provide: EncryptionService, useValue: encryptionService },
          { provide: MetricsService, useValue: { recordAlert: jest.fn(), setActiveAlerts: jest.fn() } },
        ],
      }).compile();

      const serviceWithBadDecryption = moduleRef.get(MonitoringService);

      await expect(serviceWithBadDecryption.getAlerts({})).rejects.toThrow('Decryption failed');
    });

    it('should handle missing alert in resolveAlert', async () => {
      alertsRepo.findOne.mockResolvedValue(null as any);

      // Should not throw error for non-existent alert
      await expect(service.resolveAlert('nonexistent')).resolves.not.toThrow();
      expect(alertsRepo.save).not.toHaveBeenCalled();
    });

    it('should handle database errors in resolveAlert', async () => {
      const mockAlert = { id: 'alert1', resolved: false } as any;
      alertsRepo.findOne.mockResolvedValue(mockAlert);
      alertsRepo.save.mockRejectedValue(new Error('Database save failed'));

      await expect(service.resolveAlert('alert1')).rejects.toThrow('Database save failed');
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should use custom configuration values', async () => {
      const customConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            'SECURITY_SUSPICIOUS_EVENTS_WINDOW_MIN': 5,
            'SECURITY_SUSPICIOUS_EVENTS_THRESHOLD': 10,
            'SECURITY_ALERT_RISK_THRESHOLD': 90,
            'SECURITY_FAILED_LOGIN_WINDOW_MIN': 10,
            'SECURITY_FAILED_LOGIN_THRESHOLD': 3,
          };
          return config[key] ?? defaultValue;
        }),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
          { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepo },
          { provide: ConfigService, useValue: customConfig },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
          { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn(), close: jest.fn() } },
          { provide: EncryptionService, useValue: { encrypt: (d: any) => JSON.stringify(d), decrypt: (d: any) => JSON.parse(d || '{}') } },
          { provide: MetricsService, useValue: { recordAlert: jest.fn(), setActiveAlerts: jest.fn() } },
        ],
      }).compile();

      const serviceWithCustomConfig = moduleRef.get(MonitoringService);

      await serviceWithCustomConfig.detectSuspiciousActivity('user123');

      expect(customConfig.get).toHaveBeenCalledWith('SECURITY_SUSPICIOUS_EVENTS_WINDOW_MIN', 10);
      expect(customConfig.get).toHaveBeenCalledWith('SECURITY_SUSPICIOUS_EVENTS_THRESHOLD', 20);
      expect(customConfig.get).toHaveBeenCalledWith('SECURITY_ALERT_RISK_THRESHOLD', 80);
    });

    it('should handle missing configuration gracefully', async () => {
      const emptyConfig = {
        get: jest.fn((key: string, defaultValue?: any) => defaultValue),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
          { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepo },
          { provide: ConfigService, useValue: emptyConfig },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
          { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn(), close: jest.fn() } },
          { provide: EncryptionService, useValue: { encrypt: (d: any) => JSON.stringify(d), decrypt: (d: any) => JSON.parse(d || '{}') } },
          { provide: MetricsService, useValue: { recordAlert: jest.fn(), setActiveAlerts: jest.fn() } },
        ],
      }).compile();

      const serviceWithEmptyConfig = moduleRef.get(MonitoringService);

      const result = await serviceWithEmptyConfig.detectSuspiciousActivity('user123');

      expect(result).toBeDefined();
      expect(typeof result.suspicious).toBe('boolean');
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should handle null and undefined values in createAlert', async () => {
      const alert = await service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.LOW,
        userId: null as any,
        ip: null as any,
        data: null as any,
      });

      expect(alertsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: null,
        ip: null,
      }));
    });

    it('should handle very large data objects in createAlert', async () => {
      const largeData = {
        payload: 'x'.repeat(50000),
        array: Array(1000).fill({ nested: 'data' }),
        deep: { very: { deep: { nested: { object: 'value' } } } },
      };

      const alert = await service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.HIGH,
        data: largeData,
      });

      expect(alert).toBeDefined();
    });

    it('should handle special characters in alert data', async () => {
      const specialData = {
        message: 'Alert with special chars: <script>alert("xss")</script>',
        sql: "'; DROP TABLE users; --",
        unicode: '🚨🔒💀',
        control: '\x00\x01\x02',
      };

      const alert = await service.createAlert({
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        severity: SecurityAlertSeverity.MEDIUM,
        data: specialData,
      });

      expect(alert).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent alert creation', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        service.createAlert({
          type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
          severity: SecurityAlertSeverity.LOW,
          userId: `user${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(alertsRepo.save).toHaveBeenCalledTimes(10);
    });

    it('should handle large result sets in getAlerts', async () => {
      const largeResultSet = Array(1000).fill(null).map((_, i) => ({
        id: `alert${i}`,
        type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
        data: '{}',
      }));

      alertsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          skip: jest.fn(() => qb),
          take: jest.fn(() => qb),
          getManyAndCount: jest.fn().mockResolvedValue([largeResultSet, 1000]),
        };
        return qb;
      });

      const result = await service.getAlerts({ pageSize: 1000 });

      expect(result.data).toHaveLength(1000);
      expect(result.total).toBe(1000);
    });

    it('should handle database timeout in detectSuspiciousActivity', async () => {
      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn().mockImplementation(() => 
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), 100)
            )
          ),
        };
        return qb;
      });

      await expect(service.detectSuspiciousActivity('user123')).rejects.toThrow('Query timeout');
    });
  });

  describe('Alert Severity Logic', () => {
    it('should create CRITICAL alert for very high suspicious scores', async () => {
      const detectSuspiciousSpy = jest.spyOn(service, 'detectSuspiciousActivity')
        .mockResolvedValue({ suspicious: true, score: 95, reasons: ['Extremely high activity'] });
      
      const event: SecurityEvent = {
        id: 'event1',
        type: SecurityEventType.LOGIN,
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        data: {},
        riskScore: 30,
        createdAt: new Date(),
      };

      await service.runAutomaticDetection(event);

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
          severity: SecurityAlertSeverity.CRITICAL,
        })
      );
    });

    it('should create HIGH alert for high failed login count', async () => {
      // Override the createQueryBuilder mock for this specific test
      eventsRepo.createQueryBuilder = jest.fn(() => {
        const qb: any = {
          where: jest.fn(() => qb),
          andWhere: jest.fn(() => qb),
          orderBy: jest.fn(() => qb),
          getMany: jest.fn(async () => []),
          getCount: jest.fn(async () => 10), // 2x threshold (5) = HIGH severity
        };
        return qb;
      });

      await service.checkMultipleFailedLogins('user123', '192.168.1.1');

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityAlertSeverity.HIGH,
        })
      );
    });

    it('should create MEDIUM alert for moderate failed login count', async () => {
      const qb = eventsRepo.createQueryBuilder();
      qb.getCount = jest.fn().mockResolvedValue(6); // Just above threshold (5) but below 2x threshold (10)

      await service.checkMultipleFailedLogins('user123', '192.168.1.1');

      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
          severity: SecurityAlertSeverity.MEDIUM,
        })
      );
    });
  });
});
