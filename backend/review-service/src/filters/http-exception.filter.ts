import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorCode: string;
    let message: string;
    let details: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = this.getErrorCodeFromStatus(status);
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errorCode = responseObj.error || this.getErrorCodeFromStatus(status);
        details = responseObj.details || {};
      } else {
        message = exception.message;
        errorCode = this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      // Handle specific business logic errors
      if (exception.message.includes('duplicate review')) {
        status = HttpStatus.CONFLICT;
        errorCode = 'DUPLICATE_REVIEW_ERROR';
        message = 'You have already reviewed this game';
      } else if (exception.message.includes('game ownership')) {
        status = HttpStatus.FORBIDDEN;
        errorCode = 'GAME_OWNERSHIP_ERROR';
        message = 'You must own the game to leave a review';
      } else if (exception.message.includes('review not found')) {
        status = HttpStatus.NOT_FOUND;
        errorCode = 'REVIEW_NOT_FOUND_ERROR';
        message = 'Review not found';
      } else if (exception.message.includes('external service')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'EXTERNAL_SERVICE_ERROR';
        message = 'External service temporarily unavailable';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = 'INTERNAL_SERVER_ERROR';
        message = 'An unexpected error occurred';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    // Log the error for monitoring
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED_ERROR';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN_ERROR';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND_ERROR';
      case HttpStatus.CONFLICT:
        return 'CONFLICT_ERROR';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}