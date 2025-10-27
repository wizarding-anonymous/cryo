import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { throwError } from 'rxjs';
import { LoggingService, LogContext } from '../logging/logging.service';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, body, query, params } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    // Generate correlation ID if not present
    const correlationId =
      (request as any).correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      this.generateCorrelationId();

    // Add correlation ID to request and response headers
    (request as any).correlationId = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);

    // Extract user ID if available
    const userId = (request as any).user?.id;

    // Create base log context
    const baseContext: LogContext = {
      correlationId,
      userId,
      operation: `${method} ${url}`,
      ipAddress: ip,
      userAgent,
      requestId: (request as any).id || uuidv4(),
    };

    // Log incoming request
    this.loggingService.info('Incoming HTTP request', {
      ...baseContext,
      metadata: {
        method,
        url,
        query: this.sanitizeQuery(query),
        params,
        bodySize: body ? JSON.stringify(body).length : 0,
        contentType: request.get('Content-Type'),
        accept: request.get('Accept'),
        origin: request.get('Origin'),
        referer: request.get('Referer'),
      },
    });

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          // Log successful response
          this.loggingService.info('HTTP request completed successfully', {
            ...baseContext,
            duration,
            metadata: {
              statusCode,
              responseSize: responseData
                ? JSON.stringify(responseData).length
                : 0,
              contentType: response.get('Content-Type'),
            },
          });

          // Log performance metrics if request is slow
          if (duration > 1000) {
            this.loggingService.warn('Slow HTTP request detected', {
              ...baseContext,
              duration,
              metadata: {
                statusCode,
                threshold: 1000,
              },
            });
          }
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;

        // Log error response
        this.loggingService.error(
          'HTTP request failed',
          {
            ...baseContext,
            duration,
            metadata: {
              statusCode,
              errorName: error.name,
              errorMessage: error.message,
              errorCode: error.code,
            },
          },
          error,
        );

        // Log security events for suspicious requests
        if (statusCode === 401 || statusCode === 403) {
          this.loggingService.logSecurityEvent(
            'Unauthorized access attempt',
            userId || 'anonymous',
            correlationId,
            ip,
            userAgent,
            'medium',
            {
              statusCode,
              url,
              method,
            },
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private generateCorrelationId(): string {
    return uuidv4();
  }

  private sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    const sanitized = { ...query };
    const sensitiveParams = ['password', 'token', 'secret', 'key', 'auth'];

    for (const param of sensitiveParams) {
      if (sanitized[param]) {
        sanitized[param] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
