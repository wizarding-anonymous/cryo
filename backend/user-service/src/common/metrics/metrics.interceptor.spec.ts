import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: jest.Mocked<MetricsService>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(async () => {
    const mockMetricsService = {
      recordUserOperation: jest.fn(),
      recordBatchOperation: jest.fn(),
      recordDatabaseOperation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsInterceptor,
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    interceptor = module.get<MetricsInterceptor>(MetricsInterceptor);
    metricsService = module.get(MetricsService);

    // Mock ExecutionContext with proper HttpArgumentsHost
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/users/123',
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };

    // Mock CallHandler
    mockCallHandler = {
      handle: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should record metrics for successful user operation', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('success'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('success');
          expect(metricsService.recordUserOperation).toHaveBeenCalledWith(
            'get_user_by_id',
            'success',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should record metrics for failed user operation', (done) => {
      const error = new Error('Test error');
      (mockCallHandler.handle as jest.Mock).mockReturnValue(
        throwError(() => error),
      );

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(metricsService.recordUserOperation).toHaveBeenCalledWith(
            'get_user_by_id',
            'error',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should detect batch operations from URL', (done) => {
      const httpContext = mockExecutionContext.switchToHttp();
      (httpContext.getRequest as jest.Mock).mockReturnValue({
        method: 'POST',
        url: '/users/batch',
      });

      (mockCallHandler.handle as jest.Mock).mockReturnValue(
        of('batch success'),
      );

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('batch success');
          expect(metricsService.recordBatchOperation).toHaveBeenCalledWith(
            'batch_operation',
            'success',
            1,
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should handle non-HTTP contexts gracefully', (done) => {
      const mockNonHttpContext: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(null),
          getResponse: jest.fn().mockReturnValue(null),
          getNext: jest.fn(),
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      };

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('success'));

      interceptor.intercept(mockNonHttpContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('success');
          // Should not call metrics service for non-HTTP contexts
          expect(metricsService.recordUserOperation).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle different HTTP methods', (done) => {
      const httpContext = mockExecutionContext.switchToHttp();
      (httpContext.getRequest as jest.Mock).mockReturnValue({
        method: 'POST',
        url: '/users',
      });

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('created'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('created');
          expect(metricsService.recordUserOperation).toHaveBeenCalledWith(
            'create_user',
            'success',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should handle PUT requests', (done) => {
      const httpContext = mockExecutionContext.switchToHttp();
      (httpContext.getRequest as jest.Mock).mockReturnValue({
        method: 'PUT',
        url: '/users/123',
      });

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('updated'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('updated');
          expect(metricsService.recordUserOperation).toHaveBeenCalledWith(
            'update_user',
            'success',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should handle DELETE requests', (done) => {
      const httpContext = mockExecutionContext.switchToHttp();
      (httpContext.getRequest as jest.Mock).mockReturnValue({
        method: 'DELETE',
        url: '/users/123',
      });

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('deleted'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('deleted');
          expect(metricsService.recordUserOperation).toHaveBeenCalledWith(
            'delete_user',
            'success',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should handle errors in metrics recording gracefully', (done) => {
      metricsService.recordUserOperation.mockImplementation(() => {
        throw new Error('Metrics error');
      });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of('success'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('success');
          // Should not throw even if metrics recording fails
          done();
        },
      });
    });
  });
});
