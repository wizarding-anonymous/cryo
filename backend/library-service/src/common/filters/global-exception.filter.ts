import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError } from 'typeorm';
import { randomUUID } from 'crypto';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  error: string | object;
  correlationId: string;
  message?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate correlation ID for tracking
    const correlationId = this.getCorrelationId(request);

    let status: number;
    let errorResponse: string | object;

    if (exception instanceof BadRequestException) {
      const result = this.handleValidationException(exception, response);
      status = result.status;
      errorResponse = result.errorResponse;
    } else if (exception instanceof HttpException) {
      const result = this.handleBusinessException(exception, response);
      status = result.status;
      errorResponse = result.errorResponse;
    } else if (exception instanceof QueryFailedError) {
      const result = this.handleDatabaseException(exception, response);
      status = result.status;
      errorResponse = result.errorResponse;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = 'Internal server error';
    }

    // Log the error with correlation ID
    this.logError(exception, request, correlationId, status);

    const finalResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: errorResponse,
      correlationId,
    };

    response.status(status).json(finalResponse);
  }

  private handleValidationException(
    exception: BadRequestException,
    response: Response,
  ): { status: number; errorResponse: object } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const errorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: exceptionResponse.message || exceptionResponse,
    };

    return { status, errorResponse };
  }

  private handleBusinessException(
    exception: HttpException,
    response: Response,
  ): { status: number; errorResponse: string | object } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // If it's already a structured error response, use it as is
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      return { status, errorResponse: exceptionResponse };
    }

    return { status, errorResponse: exceptionResponse };
  }

  private handleDatabaseException(
    exception: QueryFailedError,
    response: Response,
  ): { status: number; errorResponse: object } {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: object;

    // Handle specific database errors
    if (exception.message.includes('duplicate key')) {
      status = HttpStatus.CONFLICT;
      errorResponse = {
        error: 'DUPLICATE_ENTRY',
        message: 'Resource already exists',
      };
    } else if (exception.message.includes('foreign key constraint')) {
      status = HttpStatus.BAD_REQUEST;
      errorResponse = {
        error: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
      };
    } else if (exception.message.includes('not null constraint')) {
      status = HttpStatus.BAD_REQUEST;
      errorResponse = {
        error: 'MISSING_REQUIRED_FIELD',
        message: 'Required field is missing',
      };
    } else {
      errorResponse = {
        error: 'DATABASE_ERROR',
        message: 'Database operation failed',
      };
    }

    return { status, errorResponse };
  }

  private getCorrelationId(request: Request): string {
    // Try to get correlation ID from headers first
    const existingId = request.headers['x-correlation-id'] as string;
    if (existingId) {
      return existingId;
    }

    // Generate new correlation ID
    return randomUUID();
  }

  private logError(
    exception: unknown,
    request: Request,
    correlationId: string,
    status: number,
  ): void {
    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : undefined;

    const logContext = {
      method: request.method,
      url: request.url,
      correlationId,
      statusCode: status,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - ${errorMessage}`,
        {
          ...logContext,
          error: errorMessage,
          stack,
        },
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${errorMessage}`,
        logContext,
      );
    }
  }
}
