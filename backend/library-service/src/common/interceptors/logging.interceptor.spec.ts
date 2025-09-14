import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

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

  it('should log request and response', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/library/my',
          user: { sub: 'user123' },
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    const logSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    
    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ data: 'test' });
          resolve(data);
        },
      });
    });

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});