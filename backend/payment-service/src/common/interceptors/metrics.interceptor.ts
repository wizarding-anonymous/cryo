import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';
import { Request } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;

    // Extract route pattern for better metrics
    const route = this.extractRoute(url);
    const endpoint = `${method} ${route}`;

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        this.recordHttpMetrics(endpoint, 'success', duration);
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const errorType = error.constructor.name || 'UnknownError';
        this.recordHttpMetrics(endpoint, 'error', duration, errorType);
        throw error;
      }),
    );
  }

  private recordHttpMetrics(
    endpoint: string,
    status: string,
    duration: number,
    errorType?: string,
  ) {
    // Record HTTP request metrics
    // Note: You might want to add HTTP-specific metrics to MetricsService
    // For now, we'll use the existing payment metrics as an example
    if (endpoint.includes('/payments')) {
      this.metricsService.recordPaymentDuration('http', duration);
      if (errorType) {
        this.metricsService.recordPaymentError('http', errorType);
      }
    } else if (endpoint.includes('/orders')) {
      this.metricsService.recordOrderDuration(duration, status);
    }
  }

  private extractRoute(url: string): string {
    // Extract route pattern from URL
    // Replace UUIDs and numbers with placeholders for better grouping
    return url
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .split('?')[0]; // Remove query parameters
  }
}
