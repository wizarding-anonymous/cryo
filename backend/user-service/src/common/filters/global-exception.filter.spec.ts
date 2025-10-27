import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { LoggingService } from '../logging/logging.service';
import { UserServiceError, ErrorCodes } from '../errors';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let loggingService: jest.Mocked<LoggingService>;
  let httpAdapterHost: jest.Mocked<HttpAdapterHost>;
  let mockRequest: any;
  let mockResponse: any;
  let mockHost: jest.Mocked<ArgumentsHost>;

  beforeEach(async () => {
    const mockLoggingService = {
      error: jest.fn(),
      warn: jest.fn(),
      logSecurityEvent: jest.fn(),
    };

    const mockHttpAdapter = {
      reply: jest.fn(),
    };

    const mockHttpAdapterHost = {
      httpAdapter: mockHttpAdapter,
    };

    mockRequest = {
      correlationId: 'test-correlation-id',
      user: { id: 'test-user-id' },
      ip: '127.0.0.1',
      method: 'GET',
      url: '/api/users/123',
      path: '/api/users/123',
      get: jest.fn().mockReturnValue('test-user-agent'),
      socket: { remoteAddress: '127.0.0.1' },
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
    loggingService = module.get(LoggingService);
    httpAdapterHost = module.get(HttpAdapterHost);
  });

  describe('UserServiceError handling', () => {
    it('should handle UserServiceError correctly', () => {
      // Temporarily set NODE_ENV to test to use simple response format
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = UserServiceError.userNotFound(
        'test-user-id',
        'test-correlation-id',
      );

      filter.catch(error, mockHost);

      expect(loggingService.warn).toHaveBeenCalledWith(
        'Operational error occurred: USER_NOT_FOUND',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          operation: 'error_handling',
          metadata: expect.objectContaining({
            errorCode: ErrorCodes.USER_NOT_FOUND,
            statusCode: HttpStatus.NOT_FOUND,
            isOperational: true,
          }),
        }),
        error,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        'test-correlation-id',
      );

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        { message: error.message },
        HttpStatus.NOT_FOUND,
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should add retry-after header for retryable errors', () => {
      const error = UserServiceError.rateLimitExceeded(
        60,
        'test-correlation-id',
      );

      filter.catch(error, mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    });
  });

  describe('HttpException handling', () => {
    it('should handle standard HttpException', () => {
      const error = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(error, mockHost);

      expect(loggingService.warn).toHaveBeenCalledWith(
        'Operational error occurred: USER_NOT_FOUND',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          metadata: expect.objectContaining({
            errorCode: ErrorCodes.USER_NOT_FOUND,
            statusCode: HttpStatus.NOT_FOUND,
            isOperational: true,
          }),
        }),
        error,
      );
    });

    it('should handle validation errors with field details', () => {
      // Temporarily set NODE_ENV to test to use simple response format
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const validationResponse = {
        message: ['name should not be empty', 'email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      };
      const error = new HttpException(
        validationResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(error, mockHost);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        { message: ['name should not be empty', 'email must be an email'] },
        HttpStatus.BAD_REQUEST,
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Generic Error handling', () => {
    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');

      filter.catch(error, mockHost);

      expect(loggingService.error).toHaveBeenCalledWith(
        'System error occurred: INTERNAL_SERVER_ERROR',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          metadata: expect.objectContaining({
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            isOperational: false,
          }),
        }),
        error,
      );
    });

    it('should handle unknown error types', () => {
      const error = 'string error';

      filter.catch(error, mockHost);

      expect(loggingService.error).toHaveBeenCalledWith(
        'System error occurred: INTERNAL_SERVER_ERROR',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          metadata: expect.objectContaining({
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            isOperational: false,
          }),
        }),
        undefined,
      );
    });
  });

  describe('Security event logging', () => {
    it('should log unauthorized access attempts', () => {
      const error = new UserServiceError(
        ErrorCodes.UNAUTHORIZED_ACCESS,
        'Unauthorized access',
        undefined,
        'test-correlation-id',
      );

      filter.catch(error, mockHost);

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        'test-user-id',
        'test-correlation-id',
        '127.0.0.1',
        'test-user-agent',
        'medium',
        expect.objectContaining({
          method: 'GET',
          url: '/api/users/123',
          statusCode: HttpStatus.UNAUTHORIZED,
          errorCode: ErrorCodes.UNAUTHORIZED_ACCESS,
        }),
      );
    });

    it('should log rate limit exceeded events', () => {
      const error = UserServiceError.rateLimitExceeded(
        60,
        'test-correlation-id',
      );

      filter.catch(error, mockHost);

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        'Rate limit exceeded',
        'test-user-id',
        'test-correlation-id',
        '127.0.0.1',
        'test-user-agent',
        'low',
        expect.objectContaining({
          method: 'GET',
          url: '/api/users/123',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
          retryAfter: 60,
        }),
      );
    });

    it('should log critical system errors', () => {
      const error = new Error('Critical system failure');

      filter.catch(error, mockHost);

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        'Critical system error',
        'test-user-id',
        'test-correlation-id',
        '127.0.0.1',
        'test-user-agent',
        'critical',
        expect.objectContaining({
          method: 'GET',
          url: '/api/users/123',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        }),
      );
    });
  });

  describe('Test environment handling', () => {
    it('should return simple format in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = UserServiceError.userNotFound('test-user-id');

      filter.catch(error, mockHost);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        { message: error.message },
        HttpStatus.NOT_FOUND,
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should return validation fields in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const validationResponse = {
        message: ['name should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      };
      const error = new HttpException(
        validationResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(error, mockHost);

      expect(httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        { message: ['name should not be empty'] },
        HttpStatus.BAD_REQUEST,
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Correlation ID generation', () => {
    it('should generate correlation ID when missing', () => {
      mockRequest.correlationId = undefined;

      const error = UserServiceError.userNotFound('test-user-id');

      filter.catch(error, mockHost);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        expect.stringMatching(/^usr-\d+-[a-z0-9]+$/),
      );
    });
  });
});
