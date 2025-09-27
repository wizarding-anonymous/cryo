import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(
      `Incoming Request: ${method} ${url} - User-Agent: ${userAgent} - ${new Date().toISOString()}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.log(
            `Outgoing Response: ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms - ${new Date().toISOString()}`,
          );
        },
        error: error => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.error(
            `Request Error: ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms - Error: ${error.message} - ${new Date().toISOString()}`,
          );
        },
      }),
    );
  }
}
