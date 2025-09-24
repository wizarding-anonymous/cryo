import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  const createMockHost = (request: any = {}) => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockRequest = {
      url: '/api/test',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
      ...request,
    };

    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as ArgumentsHost,
      mockResponse,
      mockRequest,
    };
  };

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException with correlation ID', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Test error',
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should handle BadRequestException (validation errors)', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new BadRequestException(['field is required']);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: {
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: ['field is required'],
      },
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should handle QueryFailedError for duplicate key', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new QueryFailedError(
      'INSERT INTO table',
      [],
      new Error('duplicate key value violates unique constraint'),
    );

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      error: {
        error: 'DUPLICATE_ENTRY',
        message: 'Resource already exists',
      },
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should handle QueryFailedError for foreign key constraint', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new QueryFailedError(
      'INSERT INTO table',
      [],
      new Error('foreign key constraint fails'),
    );

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: {
        error: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
      },
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should handle QueryFailedError for not null constraint', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new QueryFailedError(
      'INSERT INTO table',
      [],
      new Error('not null constraint fails'),
    );

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: {
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Required field is missing',
      },
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should handle generic Error', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new Error('Generic error');

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal server error',
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });

  it('should use existing correlation ID from headers', () => {
    const existingCorrelationId = 'existing-correlation-id';
    const { host, mockResponse } = createMockHost({
      headers: { 'x-correlation-id': existingCorrelationId },
    });
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Test error',
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: existingCorrelationId,
    });
  });

  it('should handle structured HttpException response', () => {
    const { host, mockResponse } = createMockHost();
    const structuredResponse = {
      error: 'GAME_NOT_OWNED',
      message: 'User does not own game',
      statusCode: 403,
    };
    const exception = new HttpException(
      structuredResponse,
      HttpStatus.FORBIDDEN,
    );

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      error: structuredResponse,
      timestamp: expect.any(String),
      path: '/api/test',
      correlationId: expect.any(String),
    });
  });
});
