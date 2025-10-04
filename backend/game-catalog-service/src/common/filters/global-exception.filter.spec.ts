import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let httpAdapterHost: HttpAdapterHost;
  let mockHttpAdapter: { reply: jest.Mock };
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: { status: jest.Mock; json: jest.Mock };

  beforeEach(async () => {
    mockHttpAdapter = {
      reply: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockHttpContext = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue({}),
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };

    httpAdapterHost = {
      httpAdapter: mockHttpAdapter,
    } as unknown as HttpAdapterHost;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        {
          provide: HttpAdapterHost,
          useValue: httpAdapterHost,
        },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException with validation errors', () => {
      const validationErrors = [
        'title should not be empty',
        'price must be a number',
      ];
      const exception = new HttpException(
        { message: validationErrors },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'title should not be empty, price must be a number',
            details: { fields: validationErrors },
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle HttpException with single error message', () => {
      const exception = new HttpException(
        'Game not found',
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Game not found',
            details: {},
          },
        },
        HttpStatus.NOT_FOUND,
      );
    });

    it('should handle unauthorized exception', () => {
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Unauthorized',
            details: {},
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('should handle forbidden exception', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            details: {},
          },
        },
        HttpStatus.FORBIDDEN,
      );
    });

    it('should handle conflict exception', () => {
      const exception = new HttpException('Conflict', HttpStatus.CONFLICT);

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'CONFLICT_ERROR',
            message: 'Conflict',
            details: {},
          },
        },
        HttpStatus.CONFLICT,
      );
    });

    it('should handle non-HTTP exceptions as internal server error', () => {
      const exception = new Error('Database connection failed');

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
            details: {},
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle unknown exceptions', () => {
      const exception = 'Unknown error';

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
            details: {},
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        {
          message: 'Custom error message',
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Custom error message',
            details: {},
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    });
  });
});
