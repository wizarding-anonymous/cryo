import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response data', async () => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    
    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data.data).toEqual({ data: 'test' });
          resolve(data);
        },
      });
    });
  });

  it('should handle null response', async () => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler = {
      handle: () => of(null),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);
    
    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data', null);
          resolve(data);
        },
      });
    });
  });
});