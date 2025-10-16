import { LoggingService } from './logging.service';

export interface LogMethodOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  logArgs?: boolean;
  logResult?: boolean;
  logDuration?: boolean;
  operation?: string;
  sensitiveArgs?: number[]; // Indices of sensitive arguments to redact
}

/**
 * Decorator to automatically log method calls with performance metrics
 */
export function LogMethod(options: LogMethodOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const {
      level = 'debug',
      logArgs = false,
      logResult = false,
      logDuration = true,
      operation = `${target.constructor.name}.${propertyName}`,
      sensitiveArgs = [],
    } = options;

    descriptor.value = async function (...args: any[]) {
      const loggingService: LoggingService =
        this.loggingService || this.logger || new LoggingService();

      const startTime = Date.now();
      const correlationId = this.correlationId || 'unknown';
      const userId = this.userId || this.currentUser?.id;

      // Sanitize arguments if needed
      const sanitizedArgs = logArgs
        ? args.map((arg, index) => {
            if (sensitiveArgs.includes(index)) {
              return '[REDACTED]';
            }
            return arg;
          })
        : undefined;

      // Log method entry
      if (logArgs) {
        loggingService[level](`Method ${operation} called`, {
          correlationId,
          userId,
          operation: `${operation}_start`,
          metadata: {
            args: sanitizedArgs,
          },
        });
      }

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        // Log successful completion
        const logData: any = {
          correlationId,
          userId,
          operation: `${operation}_complete`,
          ...(logDuration && { duration }),
          metadata: {
            success: true,
            ...(logResult && {
              result: typeof result === 'object' ? '[Object]' : result,
            }),
          },
        };

        loggingService[level](
          `Method ${operation} completed successfully`,
          logData,
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error
        loggingService.error(
          `Method ${operation} failed`,
          {
            correlationId,
            userId,
            operation: `${operation}_error`,
            duration,
            metadata: {
              success: false,
              errorName: error.name,
              errorMessage: error.message,
            },
          },
          error,
        );

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator specifically for database operations
 */
export function LogDatabaseOperation(table: string, operation: string) {
  return LogMethod({
    level: 'info',
    logDuration: true,
    operation: `db_${operation}_${table}`,
  });
}

/**
 * Decorator specifically for cache operations
 */
export function LogCacheOperation(operation: string) {
  return LogMethod({
    level: 'debug',
    logDuration: true,
    operation: `cache_${operation}`,
  });
}

/**
 * Decorator specifically for external service calls
 */
export function LogExternalCall(serviceName: string, operation: string) {
  return LogMethod({
    level: 'info',
    logDuration: true,
    operation: `external_${serviceName}_${operation}`,
  });
}

/**
 * Decorator for sensitive operations that should be audited
 */
export function LogAuditableOperation(
  operation: string,
  sensitiveArgs: number[] = [],
) {
  return LogMethod({
    level: 'info',
    logArgs: true,
    logDuration: true,
    operation: `audit_${operation}`,
    sensitiveArgs,
  });
}
