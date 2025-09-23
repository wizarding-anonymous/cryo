import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const TIMEOUT_METADATA = 'timeout';

/**
 * Decorator to set custom timeout for specific endpoints
 * @param timeoutMs Timeout in milliseconds
 */
export const Timeout = (timeoutMs: number) => {
  return (
    target: any,
    _propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(TIMEOUT_METADATA, timeoutMs, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(TIMEOUT_METADATA, timeoutMs, target);
    return target;
  };
};

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly defaultTimeout = 30000; // 30 seconds default

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Get custom timeout from decorator or use default
    const customTimeout = this.reflector.get<number>(TIMEOUT_METADATA, handler);
    const timeoutMs = customTimeout || this.defaultTimeout;

    const startTime = Date.now();
    const requestId = request.requestId || 'unknown';

    this.logger.debug(
      `[${requestId}] Setting timeout of ${timeoutMs}ms for ${method} ${url}`,
    );

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        const responseTime = Date.now() - startTime;

        if (error instanceof TimeoutError) {
          this.logger.warn(
            `[${requestId}] Request timeout after ${responseTime}ms (limit: ${timeoutMs}ms) for ${method} ${url}`,
          );

          // Add timeout information to request for monitoring
          request.timedOut = true;
          request.timeoutDuration = timeoutMs;

          return throwError(
            () =>
              new RequestTimeoutException({
                message: `Request timeout after ${timeoutMs}ms`,
                code: 'REQUEST_TIMEOUT',
                endpoint: url,
                method,
                timeout: timeoutMs,
                actualDuration: responseTime,
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
