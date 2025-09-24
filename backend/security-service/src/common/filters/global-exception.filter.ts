import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggerService } from '@nestjs/common';
import {
  SecurityError,
  BlockedIPError,
  SuspiciousActivityError,
  RateLimitExceededError,
} from '../exceptions/security.exception';

const getErrorCode = (status: number, exception?: unknown): string => {
  // Check for security-specific exceptions first
  if (exception instanceof SecurityError) {
    return 'SECURITY_CHECK_FAILED';
  }
  if (exception instanceof BlockedIPError) {
    return 'IP_BLOCKED';
  }
  if (exception instanceof SuspiciousActivityError) {
    return 'SUSPICIOUS_ACTIVITY';
  }
  if (exception instanceof RateLimitExceededError) {
    return 'RATE_LIMIT_EXCEEDED';
  }

  // Default status-based codes
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT_ERROR';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMIT_EXCEEDED';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const resp = isHttp ? exception.getResponse() : 'Internal server error';
    
    let message: string;
    let additionalData: Record<string, any> = {};

    // Handle security-specific exceptions with additional data
    if (exception instanceof SecurityError) {
      const response = exception.getResponse() as any;
      message = response.message;
      if (response.riskScore !== undefined) {
        additionalData.riskScore = response.riskScore;
      }
    } else if (exception instanceof BlockedIPError) {
      const response = exception.getResponse() as any;
      message = response.message;
      additionalData.ip = response.ip;
      if (response.blockedUntil) {
        additionalData.blockedUntil = response.blockedUntil;
      }
    } else if (exception instanceof SuspiciousActivityError) {
      const response = exception.getResponse() as any;
      message = response.message;
      additionalData.userId = response.userId;
      additionalData.activityType = response.activityType;
    } else if (exception instanceof RateLimitExceededError) {
      const response = exception.getResponse() as any;
      message = response.message;
      additionalData.limit = response.limit;
      additionalData.resetTime = response.resetTime;
    } else {
      // Handle regular HTTP exceptions
      message = Array.isArray((resp as any)?.message)
        ? (resp as any).message.join(', ')
        : (resp as any)?.message || resp;
    }

    const body = {
      error: {
        code: getErrorCode(status, exception),
        message,
        ...additionalData,
      },
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    } as const;

    try {
      this.logger.warn('HTTP exception', {
        status,
        message,
        exception: (exception as any)?.stack || String(exception),
        path: body.path,
      });
    } catch (_) {}

    try {
      // Fallback console for debugging

      console.error(
        'HTTP exception',
        status,
        message,
        (exception as any)?.stack || String(exception),
      );
    } catch (_) {}

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
