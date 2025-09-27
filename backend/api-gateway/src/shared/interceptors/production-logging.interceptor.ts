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
import { MonitoringService } from '../../config/monitoring.config';

@Injectable()
export class ProductionLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProductionLoggingInterceptor.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent') || '';
    const ip = request.ip || request.socket.remoteAddress;
    const requestId =
      request.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Add request ID to response headers
    response.setHeader('X-Request-ID', requestId);

    // Log request start (only in debug mode)
    if (process.env.LOG_LEVEL === 'debug') {
      this.logger.debug(`→ ${method} ${url}`, {
        requestId,
        ip,
        userAgent,
      });
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Record metrics
        this.monitoringService.recordHttpRequest(
          method,
          this.sanitizeRoute(url),
          statusCode,
          duration / 1000, // Convert to seconds
        );

        // Log successful requests
        const isError = statusCode >= 400;
        const logLevel = isError ? 'warn' : 'log';

        if (process.env.LOG_LEVEL === 'debug' || isError) {
          this.logger[logLevel](
            `← ${method} ${url} ${statusCode} ${duration}ms`,
            {
              requestId,
              method,
              url,
              statusCode,
              duration,
              ip,
              userAgent: this.sanitizeUserAgent(userAgent),
            },
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Record error metrics
        this.monitoringService.recordHttpRequest(
          method,
          this.sanitizeRoute(url),
          statusCode,
          duration / 1000,
        );

        // Log error
        this.logger.error(`✗ ${method} ${url} ${statusCode} ${duration}ms`, {
          requestId,
          method,
          url,
          statusCode,
          duration,
          ip,
          userAgent: this.sanitizeUserAgent(userAgent),
          error: error.message,
          stack: error.stack,
        });

        throw error;
      }),
    );
  }

  private sanitizeRoute(url: string): string {
    // Remove query parameters and sanitize dynamic segments
    const path = url.split('?')[0];

    // Replace UUIDs and IDs with placeholders for better metric grouping
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:uuid',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-zA-Z0-9]{20,}/g, '/:token');
  }

  private sanitizeUserAgent(userAgent: string): string {
    // Truncate very long user agents to prevent log bloat
    return userAgent.length > 200
      ? userAgent.substring(0, 200) + '...'
      : userAgent;
  }
}
