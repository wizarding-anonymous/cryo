import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { Response } from 'express';
import { IdempotencyService, IdempotencyResult } from './idempotency.service';
import { IdempotentRequest } from './idempotency.middleware';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<IdempotentRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only process if idempotency is enabled for this request
    if (!request.idempotencyKey || !request.idempotencyRequest) {
      return next.handle();
    }

    const { idempotencyKey, idempotencyRequest } = request;

    return next.handle().pipe(
      tap((data) => {
        // Store successful response
        this.storeSuccessfulResult(
          idempotencyKey,
          idempotencyRequest,
          response,
          data,
        );
      }),
      catchError((error) => {
        // Store error response if it's a client error (4xx)
        if (this.shouldStoreError(error)) {
          this.storeErrorResult(
            idempotencyKey,
            idempotencyRequest,
            error,
          );
        }
        
        return throwError(() => error);
      }),
      finalize(() => {
        // Always clear progress marker
        this.clearProgress(idempotencyKey, idempotencyRequest);
      }),
    );
  }

  /**
   * Store successful operation result
   */
  private async storeSuccessfulResult(
    idempotencyKey: string,
    idempotencyRequest: any,
    response: Response,
    data: any,
  ): Promise<void> {
    try {
      const result: IdempotencyResult = {
        statusCode: response.statusCode || HttpStatus.OK,
        data,
        timestamp: new Date(),
        headers: this.extractResponseHeaders(response),
      };

      await this.idempotencyService.storeResult(
        idempotencyKey,
        idempotencyRequest,
        result,
      );

      // Add idempotency headers to response
      response.setHeader('X-Idempotency-Key', idempotencyKey);
      response.setHeader('X-Idempotency-Cached', 'false');
      response.setHeader('X-Idempotency-Timestamp', result.timestamp.toISOString());

      this.logger.debug('Stored successful idempotent result', {
        idempotencyKey,
        statusCode: result.statusCode,
        method: idempotencyRequest.method,
        url: idempotencyRequest.url,
      });
    } catch (error) {
      this.logger.error('Failed to store successful idempotent result', {
        idempotencyKey,
        error: error.message,
      });
    }
  }

  /**
   * Store error result for client errors (4xx)
   */
  private async storeErrorResult(
    idempotencyKey: string,
    idempotencyRequest: any,
    error: any,
  ): Promise<void> {
    try {
      const statusCode = error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      
      const result: IdempotencyResult = {
        statusCode,
        data: {
          error: error.message || 'Internal Server Error',
          statusCode,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      await this.idempotencyService.storeResult(
        idempotencyKey,
        idempotencyRequest,
        result,
      );

      this.logger.debug('Stored error idempotent result', {
        idempotencyKey,
        statusCode,
        error: error.message,
        method: idempotencyRequest.method,
        url: idempotencyRequest.url,
      });
    } catch (storeError) {
      this.logger.error('Failed to store error idempotent result', {
        idempotencyKey,
        error: storeError.message,
      });
    }
  }

  /**
   * Clear operation progress marker
   */
  private async clearProgress(
    idempotencyKey: string,
    idempotencyRequest: any,
  ): Promise<void> {
    try {
      await this.idempotencyService.clearOperationProgress(
        idempotencyKey,
        idempotencyRequest,
      );
    } catch (error) {
      this.logger.error('Failed to clear idempotency progress', {
        idempotencyKey,
        error: error.message,
      });
    }
  }

  /**
   * Determine if error should be stored for idempotency
   * Only store client errors (4xx) that are deterministic
   */
  private shouldStoreError(error: any): boolean {
    const statusCode = error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    
    // Store client errors (4xx) but not server errors (5xx)
    // Client errors are deterministic and safe to cache
    return statusCode >= 400 && statusCode < 500;
  }

  /**
   * Extract relevant response headers for caching
   */
  private extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Only cache specific headers that are safe to replay
    const safeHeaders = [
      'content-type',
      'cache-control',
      'expires',
      'last-modified',
      'etag',
    ];
    
    safeHeaders.forEach(headerName => {
      const value = response.getHeader(headerName);
      if (value && typeof value === 'string') {
        headers[headerName] = value;
      }
    });
    
    return headers;
  }
}