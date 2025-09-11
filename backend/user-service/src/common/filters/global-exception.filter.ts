import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

// A simple mapping from HTTP status to a custom error code string
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
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const isHttpException = exception instanceof HttpException;

    const httpStatus = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let exceptionResponse: any = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    // For class-validator errors, the response is an object with a 'message' array
    const errorMessage = Array.isArray(exceptionResponse.message)
      ? exceptionResponse.message.join(', ')
      : exceptionResponse.message || exceptionResponse;

    this.logger.error(
      `[${httpStatus}] ${errorMessage}`,
      exception instanceof Error ? exception.stack : '',
    );

    const responseBody = {
      error: {
        code: getErrorCode(httpStatus),
        message: errorMessage,
        details: Array.isArray(exceptionResponse.message)
          ? { fields: exceptionResponse.message }
          : {},
      },
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
