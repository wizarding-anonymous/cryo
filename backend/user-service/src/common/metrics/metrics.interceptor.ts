import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Metrics Interceptor
 * Automatically collects metrics for all HTTP requests and operations
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip metrics for non-HTTP contexts or null requests
    if (!request || !response) {
      return next.handle();
    }

    // Extract operation information
    const method = request.method;
    const url = request.url;
    const operation = this.getOperationName(method, url);
    const operationType = this.getOperationType(url);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const status = response.statusCode < 400 ? 'success' : 'error';

        // Record metrics based on operation type
        this.recordOperationMetrics(operationType, operation, status, duration);

        // Log slow operations
        if (duration > 1000) {
          this.logger.warn(
            `Slow operation detected: ${operation} took ${duration}ms`,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Record error metrics
        this.recordOperationMetrics(
          operationType,
          operation,
          'error',
          duration,
        );

        this.logger.error(
          `Operation failed: ${operation} after ${duration}ms`,
          {
            error: error.message,
            stack: error.stack,
            operation,
            duration,
          },
        );

        return throwError(() => error);
      }),
    );
  }

  /**
   * Record metrics based on operation type
   */
  private recordOperationMetrics(
    operationType: string,
    operation: string,
    status: 'success' | 'error',
    duration: number,
  ): void {
    try {
      switch (operationType) {
        case 'user':
          this.metricsService.recordUserOperation(operation, status, duration);
          break;
        case 'batch':
          // For batch operations, we'll record with default item count of 1
          // In real implementation, this should be passed from the service layer
          this.metricsService.recordBatchOperation(
            'batch_operation',
            status,
            1,
            duration,
          );
          break;
        case 'cache':
          // Cache operations are handled separately in cache service
          break;
        case 'database':
          this.metricsService.recordDatabaseOperation(
            operation,
            'users',
            status,
            duration,
          );
          break;
        default:
          this.metricsService.recordUserOperation(operation, status, duration);
      }
    } catch (error) {
      this.logger.error('Error recording operation metrics:', error);
    }
  }

  /**
   * Extract operation name from HTTP method and URL
   */
  private getOperationName(method: string, url: string): string {
    // Remove query parameters and normalize URL
    const cleanUrl = url.split('?')[0];
    const pathSegments = cleanUrl
      .split('/')
      .filter((segment) => segment.length > 0);

    // Handle different endpoint patterns
    if (pathSegments.includes('users')) {
      return this.getUserOperationName(method, pathSegments);
    } else if (pathSegments.includes('profiles')) {
      return this.getProfileOperationName(method, pathSegments);
    } else if (pathSegments.includes('batch')) {
      return this.getBatchOperationName(method, pathSegments);
    } else if (pathSegments.includes('internal')) {
      return this.getInternalOperationName(method, pathSegments);
    }

    return `${method.toLowerCase()}_${pathSegments.join('_')}`;
  }

  /**
   * Get user operation name
   */
  private getUserOperationName(method: string, pathSegments: string[]): string {
    const methodLower = method.toLowerCase();

    if (methodLower === 'get' && pathSegments.length === 2) {
      return 'get_user_by_id';
    } else if (methodLower === 'get' && pathSegments.includes('email')) {
      return 'get_user_by_email';
    } else if (methodLower === 'post' && pathSegments.length === 1) {
      return 'create_user';
    } else if (methodLower === 'patch' && pathSegments.includes('last-login')) {
      return 'update_last_login';
    } else if (methodLower === 'put') {
      return 'update_user';
    } else if (methodLower === 'delete') {
      return 'delete_user';
    }

    return `user_${methodLower}`;
  }

  /**
   * Get profile operation name
   */
  private getProfileOperationName(
    method: string,
    pathSegments: string[],
  ): string {
    const methodLower = method.toLowerCase();

    if (pathSegments.includes('avatar')) {
      return `${methodLower}_avatar`;
    } else if (pathSegments.includes('settings')) {
      return `${methodLower}_settings`;
    }

    return `profile_${methodLower}`;
  }

  /**
   * Get batch operation name
   */
  private getBatchOperationName(
    method: string,
    pathSegments: string[],
  ): string {
    const methodLower = method.toLowerCase();

    if (pathSegments.includes('create')) {
      return 'batch_create_users';
    } else if (pathSegments.includes('lookup')) {
      return 'batch_lookup_users';
    } else if (pathSegments.includes('update')) {
      return 'batch_update_users';
    } else if (pathSegments.includes('delete')) {
      return 'batch_delete_users';
    }

    return `batch_${methodLower}`;
  }

  /**
   * Get internal operation name
   */
  private getInternalOperationName(
    method: string,
    pathSegments: string[],
  ): string {
    const methodLower = method.toLowerCase();
    return `internal_${methodLower}_${pathSegments.slice(-1)[0]}`;
  }

  /**
   * Determine operation type from URL
   */
  private getOperationType(url: string): string {
    // Check for batch operations first (more specific)
    if (url.includes('/batch')) return 'batch';
    if (url.includes('/cache')) return 'cache';
    if (url.includes('/users')) return 'user';
    if (url.includes('/profiles')) return 'user';
    if (url.includes('/internal')) return 'user';
    return 'general';
  }

  /**
   * Estimate batch size from operation name (fallback when actual count not available)
   */
  private estimateBatchSize(operation: string): number {
    // This is a rough estimate - in real implementations,
    // the actual count should be passed from the service layer
    if (operation.includes('batch')) {
      return 10; // Default estimate
    }
    return 1;
  }
}
