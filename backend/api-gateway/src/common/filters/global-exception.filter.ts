import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponse } from '../interfaces/error-response.interface';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const requestId = this.getOrCreateRequestId(request);
    const path = request.originalUrl || request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      body = {
        error: String(res?.error ?? res?.status ?? exception.name ?? 'ERROR'),
        message: String(
          res?.message ?? exception.message ?? 'Unexpected error',
        ),
        statusCode: status,
        timestamp: new Date().toISOString(),
        path,
        service: 'api-gateway',
        requestId,
        details: res?.details,
      };
    } else if (exception instanceof Error) {
      body = {
        error: exception.name || 'Error',
        message: exception.message || 'Unexpected error',
        statusCode: status,
        timestamp: new Date().toISOString(),
        path,
        service: 'api-gateway',
        requestId,
      };
    } else {
      body = {
        error: 'UnknownError',
        message: 'An unknown error occurred',
        statusCode: status,
        timestamp: new Date().toISOString(),
        path,
        service: 'api-gateway',
        requestId,
      };
    }

    // Attach request id header
    response.setHeader('X-Request-Id', requestId);
    response.status(status).json(body);
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
