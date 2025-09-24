import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Enhanced APM (Application Performance Monitoring) service
 * Features:
 * - Custom transaction tracking
 * - Business metrics instrumentation
 * - Error tracking with context
 * - Performance monitoring
 * - Custom spans for detailed tracing
 */

@Injectable()
export class APMService implements OnModuleInit {
  private readonly logger = new Logger(APMService.name);
  private apmAgent: any;
  private isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('apm.enabled', false);
  }

  async onModuleInit(): Promise<void> {
    if (this.isEnabled) {
      try {
        // Import APM agent (should already be started in main.ts)
        this.apmAgent = require('elastic-apm-node');

        if (this.apmAgent.isStarted()) {
          this.logger.log('APM service initialized successfully');
          this.setupCustomInstrumentation();
        } else {
          this.logger.warn('APM agent not started, APM service disabled');
          this.isEnabled = false;
        }
      } catch (error) {
        this.logger.error('Failed to initialize APM service:', error);
        this.isEnabled = false;
      }
    } else {
      this.logger.log('APM service disabled');
    }
  }

  /**
   * Start a custom transaction
   */
  startTransaction(name: string, type: string = 'custom'): any {
    if (!this.isEnabled || !this.apmAgent) return null;

    try {
      return this.apmAgent.startTransaction(name, type);
    } catch (error) {
      this.logger.error('Failed to start APM transaction:', error);
      return null;
    }
  }

  /**
   * End a transaction
   */
  endTransaction(transaction: any, result?: string): void {
    if (!this.isEnabled || !transaction) return;

    try {
      transaction.result = result || 'success';
      transaction.end();
    } catch (error) {
      this.logger.error('Failed to end APM transaction:', error);
    }
  }

  /**
   * Start a custom span
   */
  startSpan(
    name: string,
    type: string = 'custom',
    subtype?: string,
    action?: string,
  ): any {
    if (!this.isEnabled || !this.apmAgent) return null;

    try {
      return this.apmAgent.startSpan(name, type, subtype, action);
    } catch (error) {
      this.logger.error('Failed to start APM span:', error);
      return null;
    }
  }

  /**
   * End a span
   */
  endSpan(span: any): void {
    if (!this.isEnabled || !span) return;

    try {
      span.end();
    } catch (error) {
      this.logger.error('Failed to end APM span:', error);
    }
  }

  /**
   * Capture an error with context
   */
  captureError(error: Error, context?: Record<string, any>): void {
    if (!this.isEnabled || !this.apmAgent) return;

    try {
      if (context) {
        this.apmAgent.setCustomContext(context);
      }
      this.apmAgent.captureError(error);
    } catch (apmError) {
      this.logger.error('Failed to capture APM error:', apmError);
    }
  }

  /**
   * Set user context
   */
  setUserContext(user: {
    id?: string;
    username?: string;
    email?: string;
  }): void {
    if (!this.isEnabled || !this.apmAgent) return;

    try {
      this.apmAgent.setUserContext(user);
    } catch (error) {
      this.logger.error('Failed to set APM user context:', error);
    }
  }

  /**
   * Set custom context
   */
  setCustomContext(context: Record<string, any>): void {
    if (!this.isEnabled || !this.apmAgent) return;

    try {
      this.apmAgent.setCustomContext(context);
    } catch (error) {
      this.logger.error('Failed to set APM custom context:', error);
    }
  }

  /**
   * Add labels to current transaction
   */
  addLabels(labels: Record<string, string | number | boolean>): void {
    if (!this.isEnabled || !this.apmAgent) return;

    try {
      this.apmAgent.addLabels(labels);
    } catch (error) {
      this.logger.error('Failed to add APM labels:', error);
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (!this.isEnabled || !this.apmAgent) return;

    try {
      // Create a custom span for business metrics
      const span = this.startSpan(`business.${name}`, 'business', 'metric');
      if (span) {
        if (labels) {
          span.addLabels(labels);
        }
        span.addLabels({ metric_value: value });
        this.endSpan(span);
      }
    } catch (error) {
      this.logger.error('Failed to track business metric:', error);
    }
  }

  /**
   * Track library operations
   */
  trackLibraryOperation(
    operation: string,
    userId: string,
    gameId?: string,
    duration?: number,
  ): void {
    this.trackBusinessMetric('library_operation', duration || 0, {
      operation,
      user_id: userId,
      game_id: gameId || 'unknown',
    });
  }

  /**
   * Track search operations
   */
  trackSearchOperation(
    type: string,
    userId: string,
    query: string,
    resultCount: number,
    duration?: number,
  ): void {
    this.trackBusinessMetric('search_operation', duration || 0, {
      search_type: type,
      user_id: userId,
      query_length: query.length.toString(),
      result_count: resultCount.toString(),
    });
  }

  /**
   * Track external service calls
   */
  trackExternalServiceCall(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
  ): void {
    this.trackBusinessMetric('external_service_call', duration, {
      service,
      method,
      url,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Track database operations
   */
  trackDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    rowCount?: number,
  ): void {
    this.trackBusinessMetric('database_operation', duration, {
      operation,
      table,
      row_count: rowCount?.toString() || '0',
    });
  }

  /**
   * Track cache operations
   */
  trackCacheOperation(
    operation: string,
    key: string,
    hit: boolean,
    duration?: number,
  ): void {
    this.trackBusinessMetric('cache_operation', duration || 0, {
      operation,
      key_type: this.getCacheKeyType(key),
      cache_hit: hit.toString(),
    });
  }

  /**
   * Setup custom instrumentation
   */
  private setupCustomInstrumentation(): void {
    if (!this.apmAgent) return;

    try {
      // Add custom middleware for automatic transaction naming
      this.apmAgent.addFilter((payload: any) => {
        // Enhance transaction names for better grouping
        if (payload.transaction && payload.transaction.name) {
          payload.transaction.name = this.normalizeTransactionName(
            payload.transaction.name,
          );
        }
        return payload;
      });

      // Add custom error filter
      this.apmAgent.addErrorFilter((payload: any) => {
        // Add custom error context
        if (payload.exception) {
          payload.context = payload.context || {};
          payload.context.custom = payload.context.custom || {};
          payload.context.custom.service = 'library-service';
          payload.context.custom.timestamp = new Date().toISOString();
        }
        return payload;
      });

      this.logger.log('Custom APM instrumentation setup completed');
    } catch (error) {
      this.logger.error('Failed to setup custom APM instrumentation:', error);
    }
  }

  /**
   * Normalize transaction names for better grouping
   */
  private normalizeTransactionName(name: string): string {
    // Replace UUIDs with placeholder
    return name
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '{id}',
      )
      .replace(/\/\d+/g, '/{id}');
  }

  /**
   * Get cache key type for better categorization
   */
  private getCacheKeyType(key: string): string {
    if (key.includes('library')) return 'library';
    if (key.includes('history')) return 'history';
    if (key.includes('search')) return 'search';
    if (key.includes('ownership')) return 'ownership';
    if (key.includes('user')) return 'user';
    return 'other';
  }

  /**
   * Create a decorator for automatic span tracking
   */
  static createSpanDecorator(type: string = 'custom') {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const apmService = (this as any).apmService as APMService;
        const span = apmService?.startSpan(
          `${target.constructor.name}.${propertyKey}`,
          type,
        );

        try {
          const result = await originalMethod.apply(this, args);
          apmService?.endSpan(span);
          return result;
        } catch (error) {
          if (span) {
            span.outcome = 'failure';
            apmService?.endSpan(span);
          }
          throw error;
        }
      };

      return descriptor;
    };
  }
}
