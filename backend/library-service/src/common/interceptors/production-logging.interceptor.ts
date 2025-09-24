import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { StructuredLogger } from '../../config/logging.config';
import { PrometheusMetricsService } from '../../monitoring/prometheus-metrics.service';

/**
 * Production-ready logging interceptor with structured logging and metrics
 * Features:
 * - Structured JSON logging
 * - Correlation ID tracking
 * - Performance metrics
 * - Business event logging
 * - Security event detection
 * - APM integration
 */

@Injectable()
export class ProductionLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProductionLoggingInterceptor.name);
  private readonly structuredLogger: StructuredLogger;
  private readonly isProduction: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService?: PrometheusMetricsService,
  ) {
    this.structuredLogger = new StructuredLogger('HTTP');
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, headers, user, body, query, params } = request;
    const startTime = Date.now();

    // Generate or extract correlation ID
    const correlationId =
      headers['x-correlation-id'] || this.generateCorrelationId();

    // Set correlation ID in response headers
    if (response && response.setHeader) {
      response.setHeader('x-correlation-id', correlationId);
    }

    // Extract user context
    const userId = user?.id || user?.sub || 'anonymous';
    const userRole = user?.role || 'user';

    // Build request context
    const requestContext = {
      correlationId,
      userId,
      userRole,
      method,
      url,
      userAgent: headers['user-agent'],
      ip: this.getClientIp(request),
      contentLength: headers['content-length']
        ? parseInt(headers['content-length'])
        : 0,
      timestamp: new Date().toISOString(),
      ...(this.shouldLogRequestBody(url) &&
        body && { requestBody: this.sanitizeBody(body) }),
      ...(Object.keys(query || {}).length > 0 && { queryParams: query }),
      ...(Object.keys(params || {}).length > 0 && { pathParams: params }),
    };

    // Log request
    this.structuredLogger.logWithContext(
      'info',
      `Incoming request: ${method} ${url}`,
      requestContext,
    );

    // Detect and log security events
    this.detectSecurityEvents(request, requestContext);

    // Log business events
    this.logBusinessEvents(request, requestContext);

    return next.handle().pipe(
      tap((responseData) => {
        const duration = Date.now() - startTime;
        const statusCode = response?.statusCode || 200;
        const responseSize = this.calculateResponseSize(responseData);

        const responseContext = {
          ...requestContext,
          duration,
          statusCode,
          responseSize,
          ...(this.shouldLogResponseBody(url, statusCode) &&
            responseData && {
              responseBody: this.sanitizeResponseBody(responseData),
            }),
        };

        // Record metrics if service is available
        if (this.metricsService) {
          this.metricsService.recordHttpRequest(
            method,
            this.normalizeRoute(url),
            statusCode,
            duration,
            requestContext.contentLength,
            responseSize,
            userId !== 'anonymous' ? userId : undefined,
          );
        }

        // Log response based on performance and status
        if (statusCode >= 400) {
          this.structuredLogger.logWithContext(
            'error',
            `Request failed: ${method} ${url}`,
            responseContext,
          );
        } else if (duration > 1000) {
          this.structuredLogger.logWithContext(
            'warn',
            `Slow request: ${method} ${url}`,
            responseContext,
          );
        } else {
          this.structuredLogger.logWithContext(
            'info',
            `Request completed: ${method} ${url}`,
            responseContext,
          );
        }

        // Log performance metrics
        this.structuredLogger.logPerformance(`${method} ${url}`, duration, {
          correlationId,
          userId,
          statusCode,
          responseSize,
        });

        // Log business events for successful operations
        this.logBusinessEventCompletion(request, responseData, responseContext);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;

        const errorContext = {
          ...requestContext,
          duration,
          statusCode,
          error: {
            name: error.name,
            message: error.message,
            stack: this.isProduction ? undefined : error.stack,
            code: error.code,
            details: error.details,
          },
        };

        // Record error metrics if service is available
        if (this.metricsService) {
          this.metricsService.recordHttpRequest(
            method,
            this.normalizeRoute(url),
            statusCode,
            duration,
            requestContext.contentLength,
            0,
            userId !== 'anonymous' ? userId : undefined,
          );

          this.metricsService.recordError(
            error.name || 'UnknownError',
            method,
            this.normalizeRoute(url),
          );
        }

        // Log error with full context
        this.structuredLogger.logWithContext(
          'error',
          `Request error: ${method} ${url}`,
          errorContext,
        );

        // Log security events for authentication/authorization errors
        if (statusCode === 401 || statusCode === 403) {
          this.structuredLogger.logSecurityEvent(
            'Authentication/Authorization failure',
            {
              correlationId,
              userId,
              ip: requestContext.ip,
              userAgent: requestContext.userAgent,
              statusCode,
              error: error.message,
            },
          );
        }

        return throwError(() => error);
      }),
    );
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract client IP address
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.headers['x-client-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Calculate response size
   */
  private calculateResponseSize(data: any): number {
    try {
      if (!data) return 0;
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * Normalize route for metrics (remove dynamic segments)
   */
  private normalizeRoute(url: string): string {
    return url
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      ) // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\?.*$/, ''); // Remove query parameters
  }

  /**
   * Determine if request body should be logged
   */
  private shouldLogRequestBody(url: string): boolean {
    // Don't log sensitive endpoints
    const sensitiveEndpoints = ['/auth', '/login', '/password', '/payment'];
    return !sensitiveEndpoints.some((endpoint) => url.includes(endpoint));
  }

  /**
   * Determine if response body should be logged
   */
  private shouldLogResponseBody(url: string, statusCode: number): boolean {
    // Only log response body for errors or specific endpoints in development
    return !this.isProduction && (statusCode >= 400 || url.includes('/health'));
  }

  /**
   * Sanitize request body for logging
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
    ];

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (
            sensitiveFields.some((field) => key.toLowerCase().includes(field))
          ) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Sanitize response body for logging
   */
  private sanitizeResponseBody(data: any): any {
    // Limit response body size for logging
    const maxSize = 1000;
    const stringified = JSON.stringify(data);

    if (stringified.length > maxSize) {
      return `${stringified.substring(0, maxSize)}... [truncated]`;
    }

    return data;
  }

  /**
   * Detect and log security events
   */
  private detectSecurityEvents(request: any, context: any): void {
    const { method, url, headers, body } = request;

    // Detect potential SQL injection attempts
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(UNION\s+SELECT)/i,
      /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    ];

    const checkForSqlInjection = (value: string) => {
      return sqlInjectionPatterns.some((pattern) => pattern.test(value));
    };

    // Check URL parameters
    if (url && checkForSqlInjection(url)) {
      this.structuredLogger.logSecurityEvent('Potential SQL injection in URL', {
        ...context,
        suspiciousUrl: url,
      });
    }

    // Check request body
    if (body && typeof body === 'object') {
      const bodyString = JSON.stringify(body);
      if (checkForSqlInjection(bodyString)) {
        this.structuredLogger.logSecurityEvent(
          'Potential SQL injection in request body',
          {
            ...context,
            suspiciousData: '[REDACTED]',
          },
        );
      }
    }

    // Detect unusual request patterns
    const userAgent = headers['user-agent'];
    if (!userAgent || userAgent.length < 10) {
      this.structuredLogger.logSecurityEvent('Suspicious user agent', {
        ...context,
        userAgent: userAgent || 'missing',
      });
    }

    // Detect potential brute force attempts (would need rate limiting data)
    // This would be implemented with a rate limiting service

    // Detect unusual request sizes
    const contentLength = parseInt(headers['content-length'] || '0');
    if (contentLength > 10 * 1024 * 1024) {
      // 10MB
      this.structuredLogger.logSecurityEvent('Unusually large request', {
        ...context,
        contentLength,
      });
    }
  }

  /**
   * Log business events based on request
   */
  private logBusinessEvents(request: any, context: any): void {
    const { method, url } = request;

    // Library operations
    if (url.includes('/library')) {
      if (method === 'POST' && url.includes('/add')) {
        this.structuredLogger.logBusinessEvent(
          'Game added to library',
          context,
        );
      } else if (method === 'DELETE' && url.includes('/remove')) {
        this.structuredLogger.logBusinessEvent(
          'Game removed from library',
          context,
        );
      } else if (method === 'GET' && url.includes('/my')) {
        this.structuredLogger.logBusinessEvent('Library accessed', context);
      }
    }

    // Search operations
    if (url.includes('/search')) {
      this.structuredLogger.logBusinessEvent('Search performed', {
        ...context,
        searchType: url.includes('/library') ? 'library' : 'history',
      });
    }

    // Purchase history operations
    if (url.includes('/history')) {
      this.structuredLogger.logBusinessEvent(
        'Purchase history accessed',
        context,
      );
    }

    // Ownership checks
    if (url.includes('/ownership')) {
      this.structuredLogger.logBusinessEvent(
        'Ownership check performed',
        context,
      );
    }
  }

  /**
   * Log business event completion
   */
  private logBusinessEventCompletion(
    request: any,
    responseData: any,
    context: any,
  ): void {
    const { method, url } = request;

    // Log successful operations with results
    if (
      method === 'GET' &&
      url.includes('/library/my') &&
      responseData?.games
    ) {
      this.structuredLogger.logBusinessEvent('Library retrieved successfully', {
        ...context,
        gameCount: responseData.games.length,
        totalGames: responseData.pagination?.total,
      });
    }

    if (method === 'GET' && url.includes('/search') && responseData?.games) {
      this.structuredLogger.logBusinessEvent('Search completed successfully', {
        ...context,
        resultCount: responseData.games.length,
        searchType: url.includes('/library') ? 'library' : 'history',
      });
    }

    if (
      method === 'GET' &&
      url.includes('/ownership') &&
      responseData?.owns !== undefined
    ) {
      this.structuredLogger.logBusinessEvent('Ownership check completed', {
        ...context,
        ownershipResult: responseData.owns,
      });
    }
  }
}
