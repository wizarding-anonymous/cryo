import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
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

  it('should log request and response with context', async () => {
    const mockResponse = { setHeader: jest.fn() };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/library/my',
          headers: { 'user-agent': 'test-agent' },
          user: { id: 'user123' },
          ip: '127.0.0.1',
        }),
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    const logSpy = jest
      .spyOn(interceptor['logger'], 'log')
      .mockImplementation();

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toEqual({ data: 'test' });
          resolve(data);
        },
      });
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Request] GET /api/library/my'),
      expect.objectContaining({
        method: 'GET',
        url: '/api/library/my',
        userId: 'user123',
      }),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Response] GET /api/library/my'),
      expect.objectContaining({
        duration: expect.stringMatching(/\d+ms/),
      }),
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );

    logSpy.mockRestore();
  });

  it('should log errors with context', async () => {
    const mockResponse = { setHeader: jest.fn() };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/library/add',
          headers: {},
          user: { id: 'user123' },
          ip: '127.0.0.1',
        }),
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const error = new Error('Test error');
    const mockCallHandler = {
      handle: () => throwError(() => error),
    } as CallHandler;

    const errorSpy = jest
      .spyOn(interceptor['logger'], 'error')
      .mockImplementation();

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await expect(
      new Promise((resolve, reject) => {
        result$.subscribe({
          next: resolve,
          error: reject,
        });
      }),
    ).rejects.toThrow('Test error');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Error] POST /api/library/add'),
      expect.objectContaining({
        error: 'Test error',
        userId: 'user123',
      }),
    );

    errorSpy.mockRestore();
  });

  it('should warn about slow requests', async () => {
    const mockResponse = { setHeader: jest.fn() };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/library/my',
          headers: {},
          user: { id: 'user123' },
          ip: '127.0.0.1',
        }),
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    // Mock a slow response - remove this test as it's complex to mock properly
    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    // Mock Date.now to simulate slow response
    const originalDateNow = Date.now;
    let callCount = 0;
    Date.now = jest.fn(() => {
      callCount++;
      return callCount === 1 ? 0 : 1500; // First call returns 0, second returns 1500 (1.5s later)
    });

    const warnSpy = jest
      .spyOn(interceptor['logger'], 'warn')
      .mockImplementation();

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: resolve,
      });
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Slow Request]'),
      expect.any(Object),
    );

    // Restore mocks
    warnSpy.mockRestore();
    Date.now = originalDateNow;
  });

  it('should handle missing user context', async () => {
    const mockResponse = { setHeader: jest.fn() };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/health',
          headers: {},
          ip: '127.0.0.1',
        }),
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ status: 'ok' }),
    } as CallHandler;

    const logSpy = jest
      .spyOn(interceptor['logger'], 'log')
      .mockImplementation();

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: resolve,
      });
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Request] GET /api/health'),
      expect.objectContaining({
        userId: 'anonymous',
      }),
    );

    logSpy.mockRestore();
  });
});
