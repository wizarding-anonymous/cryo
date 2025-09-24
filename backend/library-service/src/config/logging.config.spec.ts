import {
  createWinstonConfig,
  StructuredLogger,
  LOG_LEVELS,
  PERFORMANCE_THRESHOLDS,
} from './logging.config';

describe('LoggingConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('createWinstonConfig', () => {
    it('should create development configuration', () => {
      process.env.NODE_ENV = 'development';

      const config = createWinstonConfig();

      expect(config.level).toBe('debug');
      expect(config.transports).toBeDefined();
      expect(
        Array.isArray(config.transports)
          ? config.transports
          : [config.transports],
      ).toHaveLength(1); // Only console transport
      expect(config.handleExceptions).toBe(true);
      expect(config.handleRejections).toBe(true);
    });

    it('should create production configuration with file transports', () => {
      process.env.NODE_ENV = 'production';

      const config = createWinstonConfig();

      expect(config.level).toBe('info');
      expect(config.transports).toBeDefined();
      const transportsArray = Array.isArray(config.transports)
        ? config.transports
        : [config.transports];
      expect(transportsArray.length).toBeGreaterThan(1); // Console + file transports
    });

    it('should create test configuration with silent console', () => {
      process.env.NODE_ENV = 'test';

      const config = createWinstonConfig();

      expect(config.transports).toBeDefined();
      const transportsArray = Array.isArray(config.transports)
        ? config.transports
        : [config.transports];
      expect(transportsArray).toHaveLength(1);
      // Console transport should be silent in test mode
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';

      const config = createWinstonConfig();

      expect(config.level).toBe('warn');
    });
  });

  describe('StructuredLogger', () => {
    let logger: StructuredLogger;

    beforeEach(() => {
      process.env.NODE_ENV = 'test'; // Prevent file logging in tests
      logger = new StructuredLogger('TestContext');
    });

    it('should create logger with context', () => {
      expect(logger).toBeInstanceOf(StructuredLogger);
    });

    it('should log with context information', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logWithContext('info', 'Test message', {
        correlationId: 'test-123',
        userId: 'user-456',
      });

      expect(logSpy).toHaveBeenCalledWith('info', 'Test message', {
        correlationId: 'test-123',
        userId: 'user-456',
      });
    });

    it('should log performance metrics', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logPerformance('test-operation', 1500, {
        correlationId: 'test-123',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Performance: test-operation',
        {
          correlationId: 'test-123',
          duration: 1500,
          performanceMetric: true,
        },
      );
    });

    it('should log performance as info for fast operations', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logPerformance('fast-operation', 500, {
        correlationId: 'test-123',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Performance: fast-operation',
        {
          correlationId: 'test-123',
          duration: 500,
          performanceMetric: true,
        },
      );
    });

    it('should log business events', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logBusinessEvent('user-registered', {
        userId: 'user-123',
        correlationId: 'req-456',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Business Event: user-registered',
        {
          userId: 'user-123',
          correlationId: 'req-456',
          businessEvent: true,
        },
      );
    });

    it('should log security events', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logSecurityEvent('failed-login-attempt', {
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Security Event: failed-login-attempt',
        {
          userId: 'user-123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          securityEvent: true,
        },
      );
    });

    it('should log external service calls', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logExternalCall(
        'payment-service',
        'POST',
        '/api/payments',
        2500,
        500,
        {
          correlationId: 'req-123',
        },
      );

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'External Call: payment-service POST /api/payments',
        {
          correlationId: 'req-123',
          service: 'payment-service',
          method: 'POST',
          url: '/api/payments',
          duration: 2500,
          statusCode: 500,
          externalCall: true,
        },
      );
    });

    it('should log successful external calls as info', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logExternalCall(
        'user-service',
        'GET',
        '/api/users/123',
        150,
        200,
        {
          correlationId: 'req-123',
        },
      );

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'External Call: user-service GET /api/users/123',
        {
          correlationId: 'req-123',
          service: 'user-service',
          method: 'GET',
          url: '/api/users/123',
          duration: 150,
          statusCode: 200,
          externalCall: true,
        },
      );
    });

    it('should log slow external calls as warning', () => {
      const logSpy = jest.spyOn(logger['logger'], 'log');

      logger.logExternalCall('game-catalog', 'GET', '/api/games', 2500, 200, {
        correlationId: 'req-123',
      });

      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'External Call: game-catalog GET /api/games',
        {
          correlationId: 'req-123',
          service: 'game-catalog',
          method: 'GET',
          url: '/api/games',
          duration: 2500,
          statusCode: 200,
          externalCall: true,
        },
      );
    });
  });

  describe('LOG_LEVELS', () => {
    it('should define correct log levels', () => {
      expect(LOG_LEVELS.error).toBe(0);
      expect(LOG_LEVELS.warn).toBe(1);
      expect(LOG_LEVELS.info).toBe(2);
      expect(LOG_LEVELS.debug).toBe(5);
    });
  });

  describe('PERFORMANCE_THRESHOLDS', () => {
    it('should define performance thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.SLOW_REQUEST).toBe(1000);
      expect(PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST).toBe(5000);
      expect(PERFORMANCE_THRESHOLDS.SLOW_DATABASE_QUERY).toBe(500);
      expect(PERFORMANCE_THRESHOLDS.SLOW_EXTERNAL_CALL).toBe(2000);
    });
  });
});
