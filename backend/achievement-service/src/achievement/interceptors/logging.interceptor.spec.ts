import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log incoming request and outgoing response', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/achievements',
      headers: {
        'user-agent': 'test-agent',
      },
    };

    const mockResponse = {
      statusCode: 200,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Incoming Request: GET /achievements'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Outgoing Response: GET /achievements - Status: 200'),
        );
        done();
      },
    });
  });

  it('should log error when request fails', (done) => {
    const mockRequest = {
      method: 'POST',
      url: '/achievements/unlock',
      headers: {},
    };

    const mockResponse = {
      statusCode: 400,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const error = new Error('Test error');
    const mockCallHandler = {
      handle: () => {
        throw error;
      },
    } as CallHandler;

    const logSpy = jest.spyOn(interceptor['logger'], 'log');
    const errorSpy = jest.spyOn(interceptor['logger'], 'error');

    try {
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('Incoming Request: POST /achievements/unlock'),
          );
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Request Error: POST /achievements/unlock'),
          );
          done();
        },
      });
    } catch (err) {
      expect(err).toBe(error);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Incoming Request: POST /achievements/unlock'),
      );
      done();
    }
  });
});