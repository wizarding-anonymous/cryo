import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AlsService } from '../als/als.service';
import { BaseHttpException } from '../exceptions/base-http.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly alsService: AlsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = this.alsService.get('correlationId');
    let status: number;
    let errorResponse: any;

    if (exception instanceof BaseHttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      errorResponse = {
        error: payload,
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      let message: string;
      let error: string;
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
      }
      errorResponse = {
        error: {
          code:
            typeof error === 'string'
              ? error.toUpperCase().replace(/ /g, '_')
              : 'HTTP_EXCEPTION',
          message,
        },
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal server error occurred.',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
      };
      this.logger.error(
        `[${correlationId}] Unexpected error: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} - ${status} - ${JSON.stringify(errorResponse)}`,
    );

    response.status(status).json(errorResponse);
  }
}
