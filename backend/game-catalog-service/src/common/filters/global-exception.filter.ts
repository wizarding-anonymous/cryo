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
    case 400: // HttpStatus.BAD_REQUEST
      return 'VALIDATION_ERROR';
    case 401: // HttpStatus.UNAUTHORIZED
      return 'UNAUTHENTICATED';
    case 403: // HttpStatus.FORBIDDEN
      return 'FORBIDDEN';
    case 404: // HttpStatus.NOT_FOUND
      return 'NOT_FOUND';
    case 409: // HttpStatus.CONFLICT
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

    const exceptionResponse: unknown = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    // For class-validator errors, the response is an object with a 'message' array
    const responseObj =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {};
    const messageField = (responseObj as Record<string, unknown>).message;
    const errorMessage = Array.isArray(messageField)
      ? messageField.join(', ')
      : messageField || exceptionResponse;

    // Safely convert error message to string
    const errorMessageStr =
      typeof errorMessage === 'string'
        ? errorMessage
        : typeof errorMessage === 'object' && errorMessage !== null
          ? JSON.stringify(errorMessage)
          : 'Unknown error';

    this.logger.error(
      `[${httpStatus}] ${errorMessageStr}`,
      exception instanceof Error ? exception.stack : '',
    );

    const responseBody = {
      error: {
        code: getErrorCode(httpStatus),
        message: errorMessageStr,
        details: Array.isArray(messageField) ? { fields: messageField } : {},
      },
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
