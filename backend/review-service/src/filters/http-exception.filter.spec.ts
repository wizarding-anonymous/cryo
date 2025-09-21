import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test',
      method: 'GET',
    };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Test error',
          details: {},
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
        },
      });
    });

    it('should handle HttpException with object response', () => {
      const exceptionResponse = {
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        details: { field: 'email' },
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { field: 'email' },
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
        },
      });
    });

    it('should handle HttpException with object response without error code', () => {
      const exceptionResponse = {
        message: 'Not found',
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
          details: {},
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
        },
      });
    });

    it('should handle unexpected errors', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: {},
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
        },
      });
    });

    it('should handle non-Error exceptions', () => {
      const exception = 'String exception';

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: {},
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
        },
      });
    });

    it('should log errors with appropriate levels', () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');

      // Test 500 error logging
      const serverError = new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
      filter.catch(serverError, mockArgumentsHost);
      expect(loggerErrorSpy).toHaveBeenCalled();

      // Test 400 error logging
      const clientError = new HttpException('Client error', HttpStatus.BAD_REQUEST);
      filter.catch(clientError, mockArgumentsHost);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should map status codes to error codes correctly', () => {
      const testCases = [
        { status: HttpStatus.BAD_REQUEST, expectedCode: 'BAD_REQUEST' },
        { status: HttpStatus.UNAUTHORIZED, expectedCode: 'UNAUTHORIZED' },
        { status: HttpStatus.FORBIDDEN, expectedCode: 'FORBIDDEN' },
        { status: HttpStatus.NOT_FOUND, expectedCode: 'NOT_FOUND' },
        { status: HttpStatus.CONFLICT, expectedCode: 'CONFLICT' },
        { status: HttpStatus.UNPROCESSABLE_ENTITY, expectedCode: 'VALIDATION_ERROR' },
        { status: HttpStatus.TOO_MANY_REQUESTS, expectedCode: 'TOO_MANY_REQUESTS' },
        { status: HttpStatus.INTERNAL_SERVER_ERROR, expectedCode: 'INTERNAL_SERVER_ERROR' },
        { status: HttpStatus.BAD_GATEWAY, expectedCode: 'BAD_GATEWAY' },
        { status: HttpStatus.SERVICE_UNAVAILABLE, expectedCode: 'SERVICE_UNAVAILABLE' },
        { status: HttpStatus.GATEWAY_TIMEOUT, expectedCode: 'GATEWAY_TIMEOUT' },
        { status: 999, expectedCode: 'UNKNOWN_ERROR' },
      ];

      testCases.forEach(({ status, expectedCode }) => {
        const exception = new HttpException('Test', status);
        filter.catch(exception, mockArgumentsHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: expectedCode,
            }),
          }),
        );
      });
    });
  });
});