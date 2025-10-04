import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

interface RequestWithMetadata extends Request {
  requestId?: string;
  cacheHit?: boolean;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(
    private readonly performanceMonitoringService: PerformanceMonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();
    const { method, url } = request;

    const requestId = this.generateRequestId();
    request.requestId = requestId;

    this.logger.log(`[${requestId}] ${method} ${url} - Request started`);

    return next.handle().pipe(
      tap({
        next: (response: unknown) => {
          const responseTime = Date.now() - startTime;
          const responseSize = this.calculateResponseSize(response);
          const cacheHit = request.cacheHit || false;

          this.logger.log(
            `[${requestId}] ${method} ${url} - Completed in ${responseTime}ms (${responseSize} bytes)${cacheHit ? ' [CACHED]' : ''}`,
          );

          // Record performance metrics
          this.performanceMonitoringService.recordEndpointMetrics({
            endpoint: url,
            method,
            responseTime,
            cacheHit,
            responseSize,
            timestamp: new Date(),
            status: 'success',
          });
        },
        error: (error: unknown) => {
          const responseTime = Date.now() - startTime;

          this.logger.error(
            `[${requestId}] ${method} ${url} - Failed in ${responseTime}ms: ${(error as Error).message}`,
          );

          // Record error metrics
          this.performanceMonitoringService.recordEndpointMetrics({
            endpoint: url,
            method,
            responseTime,
            cacheHit: false,
            responseSize: 0,
            timestamp: new Date(),
            status: 'error',
            error: (error as Error).message,
          });
        },
      }),
    );
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private calculateResponseSize(response: unknown): number {
    if (!response) return 0;

    try {
      return JSON.stringify(response).length;
    } catch {
      return 0;
    }
  }
}
