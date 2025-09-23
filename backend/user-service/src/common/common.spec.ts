import { of } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

// Mock ExecutionContext for interceptors
const createMockExecutionContext = (statusCode = 200): any => ({
  switchToHttp: () => ({
    getResponse: () => ({
      statusCode,
    }),
  }),
});

// Mock CallHandler for interceptors
const createMockCallHandler = (data: any): any => ({
  handle: () => of(data),
});

// Mock ArgumentsHost for filters
const createMockHost = (request: any, response: any): any => ({
  switchToHttp: () => ({
    getRequest: () => request,
    getResponse: () => response,
  }),
  getClass: () => {},
  getHandler: () => {},
});

describe('Common Components', () => {
  describe('ResponseInterceptor', () => {
    it('should wrap response in a standardized format', (done) => {
      const interceptor = new ResponseInterceptor();
      const context = createMockExecutionContext(200);
      const handler = createMockCallHandler({ id: 1, name: 'Test' });

      interceptor.intercept(context, handler).subscribe((response) => {
        expect(response).toEqual({
          statusCode: 200,
          data: { id: 1, name: 'Test' },
        });
        done();
      });
    });

    it('should preserve the status code from the response', (done) => {
      const interceptor = new ResponseInterceptor();
      const context = createMockExecutionContext(201);
      const handler = createMockCallHandler({ created: true });

      interceptor.intercept(context, handler).subscribe((response) => {
        expect(response).toEqual({
          statusCode: 201,
          data: { created: true },
        });
        done();
      });
    });

    it('should handle null data', (done) => {
      const interceptor = new ResponseInterceptor();
      const context = createMockExecutionContext(204);
      const handler = createMockCallHandler(null);

      interceptor.intercept(context, handler).subscribe((response) => {
        expect(response).toEqual({
          statusCode: 204,
          data: null,
        });
        done();
      });
    });
  });

  describe('GlobalExceptionFilter', () => {
    let filter: GlobalExceptionFilter;
    let mockHttpAdapter: any;
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {};
      mockHttpAdapter = {
        reply: jest.fn(),
      };
      const httpAdapterHost = {
        httpAdapter: mockHttpAdapter,
      } as HttpAdapterHost;
      
      filter = new GlobalExceptionFilter(httpAdapterHost);
    });

    it('should catch HttpException and format response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Test error',
            details: {},
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should catch non-HttpException and format as 500', () => {
      const exception = new Error('Generic error');
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

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

    it('should handle validation errors with message array', () => {
      const validationResponse = {
        message: ['Name is required', 'Email must be valid'],
        error: 'Bad Request',
        statusCode: 400,
      };
      const exception = new HttpException(validationResponse, HttpStatus.BAD_REQUEST);
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name is required, Email must be valid',
            details: {
              fields: ['Name is required', 'Email must be valid'],
            },
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle different HTTP status codes correctly', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

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

    it('should handle CONFLICT status code', () => {
      const exception = new HttpException('Resource already exists', HttpStatus.CONFLICT);
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        {
          error: {
            code: 'CONFLICT_ERROR',
            message: 'Resource already exists',
            details: {},
          },
        },
        HttpStatus.CONFLICT,
      );
    });
  });
});