import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip, headers } = request;
    const userAgent = (headers['user-agent'] as string) || '';
    const userId = request.user?.id || 'anonymous';

    const startTime = Date.now();

    this.logger.log(
      `${method} ${url} - User: ${userId} - IP: ${ip} - UserAgent: ${userAgent}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode as number;

          this.logger.log(
            `${method} ${url} - ${statusCode} - User: ${userId} - ${duration}ms`,
          );
        },
        error: (error: any) => {
          const duration = Date.now() - startTime;
          const statusCode = (error.status as number) || 500;

          this.logger.error(
            `${method} ${url} - ${statusCode} - User: ${userId} - ${duration}ms - Error: ${error.message as string}`,
            error.stack as string,
          );
        },
      }),
    );
  }
}
