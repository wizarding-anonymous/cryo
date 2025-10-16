import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { LoggingService } from './logging.service';
import { SecurityClient } from '../../integrations/security/security.client';

describe('AuditService', () => {
  let service: AuditService;
  let loggingService: LoggingService;
  let securityClient: SecurityClient;

  beforeEach(async () => {
    const mockLoggingService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logSecurityEvent: jest.fn(),
    };

    const mockSecurityClient = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      sendAuditTrail: jest.fn().mockResolvedValue(undefined),
      reportSuspiciousActivity: jest.fn().mockResolvedValue(undefined),
      requestComplianceReport: jest.fn().mockResolvedValue(null),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', latency: 50 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: SecurityClient,
          useValue: mockSecurityClient,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    loggingService = module.get<LoggingService>(LoggingService);
    securityClient = module.get<SecurityClient>(SecurityClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log audit event successfully', () => {
    const auditEvent = {
      action: 'USER_CREATE',
      resource: 'user',
      resourceId: 'user-123',
      userId: 'admin-456',
      correlationId: 'corr-789',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      timestamp: new Date(),
      success: true,
      metadata: { email: 'test@example.com' },
    };

    service.logAuditEvent(auditEvent);

    expect(loggingService.info).toHaveBeenCalledWith(
      'Audit: USER_CREATE on user (user-123) - SUCCESS',
      expect.objectContaining({
        correlationId: 'corr-789',
        userId: 'admin-456',
        operation: 'audit_event',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: expect.objectContaining({
          action: 'USER_CREATE',
          resource: 'user',
          resourceId: 'user-123',
          success: true,
          email: 'test@example.com',
        }),
      }),
    );
  });

  it('should log failed audit event as warning', () => {
    const auditEvent = {
      action: 'USER_DELETE',
      resource: 'user',
      resourceId: 'user-123',
      userId: 'admin-456',
      correlationId: 'corr-789',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      timestamp: new Date(),
      success: false,
    };

    service.logAuditEvent(auditEvent);

    expect(loggingService.warn).toHaveBeenCalledWith(
      'Audit: USER_DELETE on user (user-123) - FAILED',
      expect.objectContaining({
        correlationId: 'corr-789',
        userId: 'admin-456',
        operation: 'audit_event',
        metadata: expect.objectContaining({
          action: 'USER_DELETE',
          success: false,
        }),
      }),
    );
  });

  it('should log data access event', () => {
    const dataAccessEvent = {
      operation: 'READ' as const,
      table: 'users',
      recordId: 'user-123',
      userId: 'admin-456',
      correlationId: 'corr-abc',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      fieldsAccessed: ['id', 'email', 'name'],
      success: true,
    };

    service.logDataAccess(dataAccessEvent);

    expect(loggingService.info).toHaveBeenCalledWith(
      'Data Access: READ on users (record user-123) - SUCCESS',
      expect.objectContaining({
        correlationId: 'corr-abc',
        userId: 'admin-456',
        operation: 'data_access',
        metadata: expect.objectContaining({
          operation: 'READ',
          table: 'users',
          recordId: 'user-123',
          fieldsAccessed: ['id', 'email', 'name'],
          success: true,
          recordCount: 1,
        }),
      }),
    );
  });

  it('should log authentication event and security event for failures', () => {
    service.logAuthenticationEvent(
      'LOGIN_FAILED',
      'user-123',
      'corr-def',
      '192.168.1.100',
      'Mozilla/5.0',
      false,
      { reason: 'invalid_password' },
    );

    expect(loggingService.warn).toHaveBeenCalledWith(
      'Audit: LOGIN_FAILED on authentication (user-123) - FAILED',
      expect.any(Object),
    );

    expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
      'Failed authentication attempt',
      'user-123',
      'corr-def',
      '192.168.1.100',
      'Mozilla/5.0',
      'medium',
      expect.objectContaining({
        action: 'LOGIN_FAILED',
        reason: 'invalid_password',
      }),
    );
  });

  it('should log profile access with cross-user detection', () => {
    service.logProfileAccess(
      'VIEW',
      'target-user-123',
      'accessing-user-456',
      'corr-ghi',
      '192.168.1.100',
      'Mozilla/5.0',
      true,
    );

    expect(loggingService.info).toHaveBeenCalledWith(
      'Audit: PROFILE_VIEW on user_profile (target-user-123) - SUCCESS',
      expect.any(Object),
    );

    expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
      'Cross-user profile access',
      'accessing-user-456',
      'corr-ghi',
      '192.168.1.100',
      'Mozilla/5.0',
      'low',
      expect.objectContaining({
        operation: 'VIEW',
        targetUserId: 'target-user-123',
        success: true,
      }),
    );
  });

  it('should log sensitive data access as security event', () => {
    service.logSensitiveDataAccess(
      'PII',
      'READ',
      'user-123',
      'corr-jkl',
      '192.168.1.100',
      'Mozilla/5.0',
      'record-456',
      'compliance_audit',
    );

    expect(loggingService.info).toHaveBeenCalledWith(
      'Audit: SENSITIVE_DATA_READ on pii (record-456) - SUCCESS',
      expect.any(Object),
    );

    expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
      'Sensitive data access: PII',
      'user-123',
      'corr-jkl',
      '192.168.1.100',
      'Mozilla/5.0',
      'medium',
      expect.objectContaining({
        dataType: 'PII',
        operation: 'READ',
        recordId: 'record-456',
        purpose: 'compliance_audit',
      }),
    );
  });

  it('should log admin action as high severity security event', () => {
    service.logAdminAction(
      'DELETE_USER',
      'user',
      'user-123',
      'admin-456',
      'corr-mno',
      '192.168.1.100',
      'Mozilla/5.0',
      true,
      { reason: 'policy_violation' },
    );

    expect(loggingService.info).toHaveBeenCalledWith(
      'Audit: ADMIN_DELETE_USER on user (user-123) - SUCCESS',
      expect.any(Object),
    );

    expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
      'Administrative action: DELETE_USER',
      'admin-456',
      'corr-mno',
      '192.168.1.100',
      'Mozilla/5.0',
      'high',
      expect.objectContaining({
        action: 'DELETE_USER',
        targetResource: 'user',
        targetResourceId: 'user-123',
        success: true,
      }),
    );
  });

  it('should log bulk operation and security event for large operations', () => {
    service.logBulkOperation(
      'DELETE',
      'users',
      1500,
      'admin-123',
      'corr-pqr',
      '192.168.1.100',
      'Mozilla/5.0',
      true,
      { status: 'inactive' },
    );

    expect(loggingService.info).toHaveBeenCalledWith(
      'Audit: BULK_DELETE on users - SUCCESS',
      expect.objectContaining({
        metadata: expect.objectContaining({
          recordCount: 1500,
          criteria: { status: 'inactive' },
        }),
      }),
    );

    expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
      'Large bulk operation: DELETE',
      'admin-123',
      'corr-pqr',
      '192.168.1.100',
      'Mozilla/5.0',
      'medium',
      expect.objectContaining({
        operation: 'DELETE',
        table: 'users',
        recordCount: 1500,
      }),
    );
  });

  it('should create data access event correctly', () => {
    const event = service.createDataAccessEvent(
      'UPDATE',
      'users',
      'user-123',
      'corr-stu',
      '192.168.1.100',
      'Mozilla/5.0',
      true,
      'record-456',
      undefined,
      ['name', 'email'],
      { name: { from: 'Old Name', to: 'New Name' } },
      undefined,
    );

    expect(event).toEqual({
      operation: 'UPDATE',
      table: 'users',
      recordId: 'record-456',
      recordIds: undefined,
      userId: 'user-123',
      correlationId: 'corr-stu',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      fieldsAccessed: ['name', 'email'],
      changes: { name: { from: 'Old Name', to: 'New Name' } },
      success: true,
      error: undefined,
    });
  });

  describe('Enhanced Data Access Logging', () => {
    it('should log enhanced data access event and send to Security Service', async () => {
      const dataAccessEvent = {
        operation: 'READ' as const,
        table: 'users',
        recordId: 'user-123',
        userId: 'admin-456',
        correlationId: 'corr-abc',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        fieldsAccessed: ['id', 'email', 'name'],
        success: true,
      };

      await service.logEnhancedDataAccess(dataAccessEvent);

      expect(loggingService.info).toHaveBeenCalledWith(
        'Data Access: READ on users (record user-123) - SUCCESS',
        expect.any(Object),
      );

      expect(securityClient.logSecurityEvent).toHaveBeenCalledWith({
        userId: 'admin-456',
        type: 'DATA_ACCESS',
        ipAddress: '192.168.1.100',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          operation: 'READ',
          table: 'users',
          recordId: 'user-123',
          fieldsAccessed: ['id', 'email', 'name'],
          success: true,
          recordCount: 1,
        }),
      });
    });

    it('should handle Security Service failures gracefully', async () => {
      const dataAccessEvent = {
        operation: 'READ' as const,
        table: 'users',
        recordId: 'user-123',
        userId: 'admin-456',
        correlationId: 'corr-abc',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        success: true,
      };

      (securityClient.logSecurityEvent as jest.Mock).mockRejectedValue(
        new Error('Security Service unavailable'),
      );

      await service.logEnhancedDataAccess(dataAccessEvent);

      expect(loggingService.error).toHaveBeenCalledWith(
        'Failed to send data access event to Security Service',
        expect.any(Object),
        expect.any(Error),
      );
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect bulk data access as suspicious activity', async () => {
      const dataAccessEvent = {
        operation: 'READ' as const,
        table: 'users',
        recordIds: Array.from({ length: 150 }, (_, i) => `user-${i}`),
        userId: 'admin-456',
        correlationId: 'corr-bulk',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        success: true,
      };

      // Spy on the logSuspiciousActivity method
      const logSuspiciousActivitySpy = jest.spyOn(service as any, 'logSuspiciousActivity');

      await service.logEnhancedDataAccess(dataAccessEvent);

      // Check if logSuspiciousActivity was called
      expect(logSuspiciousActivitySpy).toHaveBeenCalled();

      expect(securityClient.reportSuspiciousActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-456',
          activityType: 'BULK_DATA_ACCESS',
          severity: 'medium',
          riskScore: expect.any(Number),
          details: expect.objectContaining({
            operation: 'READ',
            table: 'users',
            recordCount: 150,
          }),
        }),
      );
    });

    it('should detect unusual time access as suspicious activity', async () => {
      // Mock current time to be 3 AM local time (unusual hour)
      // Create a date that will be 3 AM in local timezone
      const mockDate = new Date();
      mockDate.setHours(3, 0, 0, 0); // Set to 3 AM local time

      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // Verify the mocked time
      const currentHour = new Date().getHours();
      expect(currentHour).toBe(3); // Should be 3 AM

      const dataAccessEvent = {
        operation: 'READ' as const,
        table: 'users',
        recordId: 'user-123',
        userId: 'admin-456',
        correlationId: 'corr-night',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        success: true,
      };

      await service.logEnhancedDataAccess(dataAccessEvent);

      expect(securityClient.reportSuspiciousActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-456',
          activityType: 'UNUSUAL_TIME_ACCESS',
          severity: 'low',
          riskScore: 25,
          details: expect.objectContaining({
            accessHour: 3,
            operation: 'READ',
            table: 'users',
          }),
        }),
      );

      // Restore real timers
      jest.useRealTimers();
    });

    it('should detect cross-user access as suspicious activity', async () => {
      const dataAccessEvent = {
        operation: 'READ' as const,
        table: 'users',
        recordIds: ['user-1', 'user-2', 'user-3'],
        userId: 'admin-456',
        correlationId: 'corr-cross',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        success: true,
      };

      await service.logEnhancedDataAccess(dataAccessEvent);

      expect(securityClient.reportSuspiciousActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-456',
          activityType: 'CROSS_USER_ACCESS',
          severity: 'medium',
          riskScore: 60,
          details: expect.objectContaining({
            operation: 'READ',
            table: 'users',
            recordCount: 3,
            suspectedCrossUserAccess: true,
          }),
        }),
      );
    });
  });

  describe('Compliance Event Logging', () => {
    it('should log GDPR compliance event', async () => {
      const complianceEvent = {
        type: 'GDPR_DATA_ACCESS' as const,
        userId: 'user-123',
        correlationId: 'corr-gdpr',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        dataSubject: 'user-123',
        purpose: 'User profile access',
        dataCategories: ['personal_data', 'profile_data'],
        success: true,
      };

      await service.logComplianceEvent(complianceEvent);

      expect(loggingService.info).toHaveBeenCalledWith(
        'Compliance Event: GDPR_DATA_ACCESS - User profile access - SUCCESS',
        expect.any(Object),
      );

      expect(securityClient.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'DATA_ACCESS',
          ipAddress: '192.168.1.100',
          timestamp: expect.any(Date),
          details: expect.objectContaining({
            complianceType: 'GDPR_DATA_ACCESS',
            dataSubject: 'user-123',
            purpose: 'User profile access',
            dataCategories: ['personal_data', 'profile_data'],
            success: true,
          }),
        }),
      );
    });
  });

  describe('Enhanced User Operation Logging', () => {
    it('should log user operation with enhanced context', async () => {
      await service.logUserOperation(
        'user_create',
        'user-123',
        'corr-create',
        '192.168.1.100',
        'Mozilla/5.0',
        true,
        150,
        {
          email: 'test@example.com',
          fieldsAccessed: ['email', 'password', 'name'],
        },
        {
          name: { from: undefined, to: 'John Doe' },
        },
      );

      expect(loggingService.info).toHaveBeenCalledWith(
        'Audit: user_create on user (user-123) - SUCCESS',
        expect.any(Object),
      );

      expect(securityClient.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'DATA_ACCESS',
          details: expect.objectContaining({
            complianceType: 'GDPR_DATA_ACCESS',
            dataSubject: 'user-123',
            purpose: 'User account creation',
            dataCategories: ['personal_data', 'profile_data'],
            success: true,
          }),
        }),
      );
    });
  });

  describe('Activity Cache Management', () => {
    it('should clear old activity cache entries', () => {
      // Restore original Date for this test
      const originalDate = Date;
      global.Date = originalDate;

      const realNow = Date.now();

      // Add some mock activities to the cache
      const userId = 'user-test-cache';
      const oldActivity = {
        timestamp: new Date(realNow - 25 * 60 * 60 * 1000), // 25 hours ago
        operation: 'READ',
        table: 'users',
        recordCount: 1,
        ipAddress: '192.168.1.100',
        success: true,
      };

      const recentActivity = {
        timestamp: new Date(realNow - 1 * 60 * 60 * 1000), // 1 hour ago
        operation: 'READ',
        table: 'users',
        recordCount: 1,
        ipAddress: '192.168.1.100',
        success: true,
      };

      // Access private cache to set up test data
      const cache = (service as any).userActivityCache;
      cache.set(userId, [oldActivity, recentActivity]);

      service.clearOldActivityCache();

      const remainingActivities = cache.get(userId);
      expect(remainingActivities).toHaveLength(1);
      expect(remainingActivities[0]).toEqual(recentActivity);
    });
  });

  describe('Operation Mapping', () => {
    it('should map operations to GDPR-relevant correctly', () => {
      const isGDPRRelevant = (service as any).isGDPRRelevantOperation;

      expect(isGDPRRelevant('profile_view')).toBe(true);
      expect(isGDPRRelevant('user_create')).toBe(true);
      expect(isGDPRRelevant('data_export')).toBe(true);
      expect(isGDPRRelevant('random_operation')).toBe(false);
    });

    it('should map operations to data access operations correctly', () => {
      const mapOperation = (service as any).mapOperationToDataAccess;

      expect(mapOperation('user_create')).toBe('CREATE');
      expect(mapOperation('profile_read')).toBe('READ');
      expect(mapOperation('user_update')).toBe('UPDATE');
      expect(mapOperation('user_delete')).toBe('DELETE');
      expect(mapOperation('bulk_read')).toBe('BULK_READ'); // Falls back to READ because bulk logic checks READ after BULK
      expect(mapOperation('unknown_operation')).toBe('READ');
    });

    it('should get operation purpose correctly', () => {
      const getPurpose = (service as any).getOperationPurpose;

      expect(getPurpose('profile_view')).toBe('User profile access');
      expect(getPurpose('user_create')).toBe('User account creation');
      expect(getPurpose('data_export')).toBe('Data portability request');
      expect(getPurpose('unknown_operation')).toBe('General user service operation');
    });
  });

}); // Closing bracket for main describe('AuditService', () => {