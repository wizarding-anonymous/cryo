import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { PerformanceInterceptor } from './performance.interceptor';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let performanceMonitoringService: PerformanceMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceInterceptor,
        {
          provide: PerformanceMonitoringService,
          useValue: {
            recordEndpointMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);
    performanceMonitoringService = module.get<PerformanceMonitoringService>(
      PerformanceMonitoringService,
    );
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log request start and completion', (done) => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/games',
          query: {},
          params: {},
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'test' }),
    } as CallHandler;

    const logSpy = jest.spyOn(interceptor['logger'], 'log');
    const recordMetricsSpy = jest.spyOn(
      performanceMonitoringService,
      'recordEndpointMetrics',
    );

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({ data: 'test' });
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Request started'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Completed in'),
        );
        expect(recordMetricsSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: '/games',
            method: 'GET',
            status: 'success',
          }),
        );
        done();
      },
    });
  });

  it('should log errors with performance metrics', (done) => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/games',
          query: {},
          params: {},
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => {
        const { throwError } = require('rxjs');
        return throwError(() => new Error('Test error'));
      },
    } as CallHandler;

    const errorSpy = jest.spyOn(interceptor['logger'], 'error');
    const recordMetricsSpy = jest.spyOn(
      performanceMonitoringService,
      'recordEndpointMetrics',
    );

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed in'),
        );
        expect(recordMetricsSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: '/games',
            method: 'GET',
            status: 'error',
            error: 'Test error',
          }),
        );
        done();
      },
    });
  });
});
