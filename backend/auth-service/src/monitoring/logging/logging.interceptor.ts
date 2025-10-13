import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CorrelationService } from './correlation.service';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly correlationService: CorrelationService,
    private readonly logger: StructuredLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const correlationContext = this.correlationService.createContextFromRequest(request);
    
    return new Observable(observer => {
      this.correlationService.run(correlationContext, () => {
        const startTime = Date.now();
        
        // Log incoming request
        this.logger.log('Incoming request', {
          endpoint: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
          metadata: {
            headers: this.sanitizeHeaders(request.headers),
            query: request.query,
            params: request.params,
          },
        });

        // Update correlation context with user info if available
        if (request.user?.id) {
          this.correlationService.updateContext({
            userId: request.user.id,
            sessionId: request.user.sessionId,
          });
        }

        const subscription = next.handle().pipe(
          tap((data) => {
            const duration = Date.now() - startTime;
            
            // Log successful response
            this.logger.log('Request completed', {
              endpoint: request.url,
              method: request.method,
              statusCode: response.statusCode,
              duration,
              metadata: {
                responseSize: JSON.stringify(data || {}).length,
              },
            });
          }),
          catchError((error) => {
            const duration = Date.now() - startTime;
            
            // Log error response
            this.logger.error('Request failed', error, {
              endpoint: request.url,
              method: request.method,
              statusCode: response.statusCode || 500,
              duration,
              metadata: {
                errorName: error.name,
                errorMessage: error.message,
              },
            });

            throw error;
          }),
        ).subscribe({
          next: (value) => observer.next(value),
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    });
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}