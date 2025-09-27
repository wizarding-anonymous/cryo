import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponse } from '../interfaces/error-response.interface';
import { ServiceException } from '../exceptions/service.exception';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const requestId = this.getOrCreateRequestId(request);
    const path = request.originalUrl || request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorResponse;

    if (exception instanceof HttpException) {
      body = this.handleHttpException(exception, path, requestId);
      status = exception.getStatus();
    } else if (exception instanceof ServiceException) {
      body = this.handleServiceException(exception, path, requestId);
      status = exception.getStatus();
    } else if (exception instanceof Error) {
      body = this.handleUnknownException(exception, path, requestId);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    } else {
      body = this.handleUnknownException(
        new Error('An unknown error occurred'),
        path,
        requestId,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Log error with correlation ID
    this.logError(exception, requestId, path, status);

    // Attach request id header
    response.setHeader('X-Request-Id', requestId);
    response.status(status).json(body);
  }

  private handleHttpException(
    exception: HttpException,
    path: string,
    requestId: string,
  ): ErrorResponse {
    const status = exception.getStatus();
    const res = exception.getResponse() as any;

    return {
      error: String(
        res?.error ?? res?.status ?? exception.name ?? 'HTTP_ERROR',
      ),
      message: String(
        res?.message ?? exception.message ?? 'HTTP error occurred',
      ),
      statusCode: status,
      timestamp: new Date().toISOString(),
      path,
      service: res?.service ?? 'api-gateway',
      requestId,
      details: res?.details,
    };
  }

  private handleServiceException(
    exception: ServiceException,
    path: string,
    requestId: string,
  ): ErrorResponse {
    const status = exception.getStatus();
    const res = exception.getResponse() as any;

    return {
      error: String(res?.error ?? 'SERVICE_ERROR'),
      message: String(
        res?.message ?? exception.message ?? 'Service error occurred',
      ),
      statusCode: status,
      timestamp: new Date().toISOString(),
      path,
      service: res?.service ?? 'api-gateway',
      requestId,
      details: res?.details,
    };
  }

  private handleUnknownException(
    exception: Error,
    path: string,
    requestId: string,
  ): ErrorResponse {
    return {
      error: exception.name || 'INTERNAL_SERVER_ERROR',
      message: exception.message || 'An unexpected error occurred',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path,
      service: 'api-gateway',
      requestId,
    };
  }

  private logError(
    exception: unknown,
    requestId: string,
    path: string,
    statusCode: number,
  ): void {
    const errorContext = {
      requestId,
      path,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(
          `HTTP Exception: ${exception.message}`,
          exception.stack,
          errorContext,
        );
      } else {
        this.logger.warn(`HTTP Exception: ${exception.message}`, errorContext);
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
        errorContext,
      );
    } else {
      this.logger.error(
        'Unknown Exception occurred',
        String(exception),
        errorContext,
      );
    }
  }

  private getOrCreateRequestId(request: Request & { id?: string }): string {
    const headerId = request.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
    if (Array.isArray(headerId) && headerId.length > 0) return headerId[0];
    if (request.id) return request.id;
    const id = randomUUID();
    (request as any).id = id;
    return id;
  }
}
