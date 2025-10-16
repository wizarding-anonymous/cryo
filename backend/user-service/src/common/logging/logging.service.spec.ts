import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from './logging.service';

describe('LoggingService', () => {
  let service: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingService],
    }).compile();

    service = module.get<LoggingService>(LoggingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sanitize sensitive data', () => {
    const testData = {
      email: 'test@example.com',
      password: 'secret123',
      token: 'jwt-token',
      name: 'Test User',
    };

    // Use reflection to access private method for testing
    const sanitizeData = (service as any).sanitizeData.bind(service);
    const sanitized = sanitizeData(testData);

    expect(sanitized.email).toBe('test@example.com');
    expect(sanitized.name).toBe('Test User');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
  });

  it('should create structured log entry', () => {
    const context = {
      correlationId: 'test-123',
      userId: 'user-456',
      operation: 'test_operation',
      duration: 100,
      metadata: {
        testField: 'testValue',
        password: 'should-be-redacted',
      },
    };

    // Use reflection to access private method for testing
    const createLogEntry = (service as any).createLogEntry.bind(service);
    const logEntry = createLogEntry('info', 'Test message', context);

    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('Test message');
    expect(logEntry.correlationId).toBe('test-123');
    expect(logEntry.userId).toBe('user-456');
    expect(logEntry.operation).toBe('test_operation');
    expect(logEntry.duration).toBe(100);
    expect(logEntry.metadata.testField).toBe('testValue');
    expect(logEntry.metadata.password).toBe('[REDACTED]');
    expect(logEntry.service).toBe('user-service');
  });

  it('should log user operation with performance metrics', () => {
    const logSpy = jest.spyOn(service, 'info');

    service.logUserOperation('user_create', 'user-123', 'corr-456', 150, true, {
      email: 'test@example.com',
    });

    expect(logSpy).toHaveBeenCalledWith(
      'User operation user_create completed',
      expect.objectContaining({
        correlationId: 'corr-456',
        userId: 'user-123',
        operation: 'user_create',
        duration: 150,
        metadata: expect.objectContaining({
          success: true,
          email: 'test@example.com',
        }),
      }),
    );
  });

  it('should log database operation with performance metrics', () => {
    const logSpy = jest.spyOn(service, 'info');

    service.logDatabaseOperation('SELECT', 'users', 'corr-789', 75, true, 5);

    expect(logSpy).toHaveBeenCalledWith(
      'Database SELECT on users completed',
      expect.objectContaining({
        correlationId: 'corr-789',
        operation: 'db_SELECT',
        duration: 75,
        metadata: expect.objectContaining({
          table: 'users',
          recordCount: 5,
          success: true,
        }),
      }),
    );
  });

  it('should log cache operation with hit/miss information', () => {
    const debugSpy = jest.spyOn(service, 'debug');

    service.logCacheOperation('get', 'user:123', 'corr-abc', 25, true, {
      ttl: 300,
    });

    expect(debugSpy).toHaveBeenCalledWith(
      'Cache get for key user:123 - HIT',
      expect.objectContaining({
        correlationId: 'corr-abc',
        operation: 'cache_get',
        duration: 25,
        metadata: expect.objectContaining({
          key: 'user:123',
          hit: true,
          ttl: 300,
        }),
      }),
    );
  });

  it('should log external service call', () => {
    const infoSpy = jest.spyOn(service, 'info');

    service.logExternalServiceCall(
      'auth-service',
      'validate_token',
      'corr-def',
      200,
      true,
      200,
    );

    expect(infoSpy).toHaveBeenCalledWith(
      'External service call to auth-service completed',
      expect.objectContaining({
        correlationId: 'corr-def',
        operation: 'external_validate_token',
        duration: 200,
        metadata: expect.objectContaining({
          serviceName: 'auth-service',
          statusCode: 200,
          success: true,
        }),
      }),
    );
  });

  it('should log security event with appropriate severity', () => {
    const warnSpy = jest.spyOn(service, 'warn');

    service.logSecurityEvent(
      'Failed login attempt',
      'user-789',
      'corr-ghi',
      '192.168.1.100',
      'Mozilla/5.0',
      'high',
      { attempts: 3 },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      'Security event: Failed login attempt',
      expect.objectContaining({
        correlationId: 'corr-ghi',
        userId: 'user-789',
        operation: 'security_event',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: expect.objectContaining({
          event: 'Failed login attempt',
          severity: 'high',
          attempts: 3,
        }),
      }),
    );
  });

  it('should extract request context correctly', () => {
    const mockRequest = {
      correlationId: 'req-123',
      user: { id: 'user-456' },
      ip: '192.168.1.100',
      connection: { remoteAddress: '192.168.1.100' },
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      id: 'request-789',
    } as any;

    const context = service.extractRequestContext(mockRequest);

    expect(context.correlationId).toBe('req-123');
    expect(context.userId).toBe('user-456');
    expect(context.ipAddress).toBe('192.168.1.100');
    expect(context.userAgent).toBe('Mozilla/5.0');
    expect(context.requestId).toBe('request-789');
  });
});
