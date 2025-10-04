import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { LoggingService } from './logging.service';

@Injectable()
export class HealthMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HealthMonitoringInterceptor.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const { method, url, headers, ip } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId =
      headers['x-request-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap((data: unknown) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode;

        // Record metrics
        this.metricsService.incrementHttpRequests(
          String(method),
          String(url),
          statusCode,
        );
        this.metricsService.recordHttpRequestDuration(
          String(method),
          String(url),
          duration,
        );

        // Log request
        this.loggingService.logHttpRequest(
          String(method),
          String(url),
          statusCode,
          duration,
          {
            requestId: String(requestId),
            userAgent: String(userAgent),
            ip: String(ip),
            responseSize: JSON.stringify(data).length,
          },
        );

        // Log performance metrics for slow requests
        if (duration > 1) {
          this.loggingService.logPerformanceMetrics(
            'http_request',
            {
              duration,
              memoryUsage: process.memoryUsage().heapUsed,
            },
            {
              requestId: String(requestId),
              method: String(method),
              url: String(url),
            },
          );
        }
      }),
      catchError((error: unknown) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = (error as { status?: number }).status || 500;

        // Record error metrics
        this.metricsService.incrementHttpRequests(
          String(method),
          String(url),
          statusCode,
        );
        this.metricsService.recordHttpRequestDuration(
          String(method),
          String(url),
          duration,
        );

        // Log error
        this.loggingService.logError(error as Error, 'http_request', {
          requestId: String(requestId),
          method: String(method),
          url: String(url),
          userAgent: String(userAgent),
          ip: String(ip),
          duration,
        });

        throw error;
      }),
    );
  }
}
