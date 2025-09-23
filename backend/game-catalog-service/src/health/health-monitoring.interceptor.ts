import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { LoggingService } from './logging.service';

@Injectable()
export class HealthMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HealthMonitoringInterceptor.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const { method, url, headers, ip } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId =
      headers['x-request-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap((data) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode;

        // Record metrics
        this.metricsService.incrementHttpRequests(method, url, statusCode);
        this.metricsService.recordHttpRequestDuration(method, url, duration);

        // Log request
        this.loggingService.logHttpRequest(method, url, statusCode, duration, {
          requestId,
          userAgent,
          ip,
          responseSize: JSON.stringify(data).length,
        });

        // Log performance metrics for slow requests
        if (duration > 1) {
          this.loggingService.logPerformanceMetrics(
            'http_request',
            {
              duration,
              memoryUsage: process.memoryUsage().heapUsed,
            },
            {
              requestId,
              method,
              url,
            },
          );
        }
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.status || 500;

        // Record error metrics
        this.metricsService.incrementHttpRequests(method, url, statusCode);
        this.metricsService.recordHttpRequestDuration(method, url, duration);

        // Log error
        this.loggingService.logError(error, 'http_request', {
          requestId,
          method,
          url,
          userAgent,
          ip,
          duration,
        });

        throw error;
      }),
    );
  }
}
