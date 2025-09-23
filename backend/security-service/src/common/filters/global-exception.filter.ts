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

const getErrorCode = (status: number): string => {
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
    const resp = isHttp ? (exception as HttpException).getResponse() : 'Internal server error';
    const message = Array.isArray((resp as any)?.message)
      ? (resp as any).message.join(', ')
      : (resp as any)?.message || resp;

    const body = {
      error: {
        code: getErrorCode(status),
        message,
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
      // eslint-disable-next-line no-console
      console.error('HTTP exception', status, message, (exception as any)?.stack || String(exception));
    } catch (_) {}

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
