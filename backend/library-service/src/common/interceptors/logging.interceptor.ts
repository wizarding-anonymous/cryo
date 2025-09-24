import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Enhanced Logging Interceptor for request tracing
 * Features:
 * - Request/Response logging with timing
 * - User context tracking
 * - Error logging
 * - Correlation ID support
 * - Performance monitoring
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, headers, user } = request;
    const now = Date.now();

    // Generate correlation ID if not present
    const correlationId =
      headers['x-correlation-id'] || this.generateCorrelationId();

    // Set correlation ID in response headers
    if (response && response.setHeader) {
      response.setHeader('x-correlation-id', correlationId);
    }

    // Log request with context
    const requestContext = {
      method,
      url,
      correlationId,
      userId: user?.id || 'anonymous',
      userAgent: headers['user-agent'],
      ip: this.getClientIp(request),
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`[Request] ${method} ${url}`, requestContext);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - now;
        const responseContext = {
          ...requestContext,
          duration: `${duration}ms`,
          statusCode: response?.statusCode || 200,
          responseSize: this.getResponseSize(data),
        };

        // Log performance warning for slow requests
        if (duration > 1000) {
          this.logger.warn(
            `[Slow Request] ${method} ${url} - ${duration}ms`,
            responseContext,
          );
        } else {
          this.logger.log(
            `[Response] ${method} ${url} - ${duration}ms`,
            responseContext,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - now;
        const errorContext = {
          ...requestContext,
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack,
          statusCode: error.status || 500,
        };

        this.logger.error(
          `[Error] ${method} ${url} - ${duration}ms`,
          errorContext,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * Generate a unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Calculate approximate response size
   */
  private getResponseSize(data: any): string {
    try {
      if (!data) return '0 bytes';
      const size = JSON.stringify(data).length;
      if (size < 1024) return `${size} bytes`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
      return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    } catch {
      return 'unknown';
    }
  }
}
