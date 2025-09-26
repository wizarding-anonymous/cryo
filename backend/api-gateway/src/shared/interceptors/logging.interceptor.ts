import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    
    const { method, originalUrl, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = (req as any).id || headers['x-request-id'] || 'unknown';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    const start = Date.now();
    
    // Log incoming request
    this.logger.log(
      `[${requestId}] ${method} ${originalUrl} - ${clientIp} - ${userAgent}`
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        
        // Log successful response
        this.logger.log(
          `[${requestId}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
        );
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const statusCode = error.status || error.statusCode || 500;
        
        // Log error response
        this.logger.error(
          `[${requestId}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms - ${error.message}`,
          error.stack
        );
        
        return throwError(() => error);
      }),
    );
  }
}
