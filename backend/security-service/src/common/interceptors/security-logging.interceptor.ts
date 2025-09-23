import { CallHandler, ExecutionContext, Injectable, NestInterceptor, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Inject } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as winston from 'winston';

@Injectable()
export class SecurityLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const start = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userId = req.user?.id ?? null;
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log('Security API access', {
            method,
            url: originalUrl ?? req.url,
            status: res.statusCode,
            durationMs: Date.now() - start,
            ip,
            userId,
            correlationId,
          });
        },
        error: (err) => {
          const res = context.switchToHttp().getResponse();
          this.logger.warn('Security API error', {
            method,
            url: originalUrl ?? req.url,
            status: res.statusCode,
            durationMs: Date.now() - start,
            ip,
            userId,
            error: err?.message,
            correlationId,
          });
        },
      }),
    );
  }
}
