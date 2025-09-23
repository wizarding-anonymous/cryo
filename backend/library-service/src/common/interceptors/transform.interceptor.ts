import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    correlationId?: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Enhanced Transform Interceptor for standardizing API responses
 * Features:
 * - Consistent response structure
 * - Metadata injection (timestamp, correlation ID, version)
 * - Pagination metadata handling
 * - Error response standardization
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers['x-correlation-id'];

    return next.handle().pipe(
      map((data) => {
        // Handle already transformed responses (avoid double wrapping)
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }

        const response: StandardResponse<T> = {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        };

        // Add correlation ID if available
        if (correlationId) {
          response.meta!.correlationId = correlationId;
        }

        // Handle pagination metadata
        if (this.isPaginatedResponse(data)) {
          response.meta!.pagination = {
            page: data.pagination.page,
            limit: data.pagination.limit,
            total: data.pagination.total,
            totalPages: data.pagination.totalPages,
          };
        }

        return response;
      }),
    );
  }

  /**
   * Check if the response contains pagination information
   */
  private isPaginatedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      data.pagination &&
      typeof data.pagination.page === 'number' &&
      typeof data.pagination.limit === 'number' &&
      typeof data.pagination.total === 'number'
    );
  }
}
