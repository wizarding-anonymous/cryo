import { LoggingService } from '../../src/common/logging/logging.service';
import { AuditService } from '../../src/common/logging/audit.service';

export const createMockLoggingService = (): Partial<LoggingService> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logDatabaseOperation: jest.fn(),
  logCacheOperation: jest.fn(),
  logSecurityEvent: jest.fn(),
});

export const createMockAuditService = (): Partial<AuditService> => ({
  logDataAccess: jest.fn(),
  logUserOperation: jest.fn(),
  logAuditEvent: jest.fn(),
  logAuthenticationEvent: jest.fn(),
  logProfileAccess: jest.fn(),
  logSensitiveDataAccess: jest.fn(),
  logAdminAction: jest.fn(),
  logBulkOperation: jest.fn(),
  logEnhancedDataAccess: jest.fn(),
  logComplianceEvent: jest.fn(),
  logSuspiciousActivity: jest.fn(),
  createDataAccessEvent: jest.fn(),
  clearOldActivityCache: jest.fn(),
});

export const mockLoggingServiceProvider = {
  provide: LoggingService,
  useValue: createMockLoggingService(),
};

export const mockAuditServiceProvider = {
  provide: AuditService,
  useValue: createMockAuditService(),
};