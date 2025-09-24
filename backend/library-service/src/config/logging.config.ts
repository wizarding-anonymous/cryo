import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

/**
 * Winston logging configuration for production readiness
 * Features:
 * - Structured JSON logging
 * - Multiple log levels and transports
 * - Correlation ID support
 * - Performance monitoring
 * - Error tracking
 */

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(
    ({
      timestamp,
      level,
      message,
      context,
      correlationId,
      userId,
      ...meta
    }) => {
      const logEntry: any = {
        timestamp,
        level,
        message,
        service: 'library-service',
        environment: process.env.NODE_ENV || 'development',
        ...meta,
      };

      if (context) {
        logEntry.context = context;
      }
      if (correlationId) {
        logEntry.correlationId = correlationId;
      }
      if (userId) {
        logEntry.userId = userId;
      }

      return JSON.stringify(logEntry);
    },
  ),
);

// Development format for better readability
const devFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS',
  }),
  winston.format.colorize(),
  winston.format.printf(
    ({
      timestamp,
      level,
      message,
      context,
      correlationId,
      userId,
      ...meta
    }) => {
      const contextStr = context ? `[${context}]` : '';
      const correlationStr = correlationId ? `[${correlationId}]` : '';
      const userStr = userId ? `[User:${userId}]` : '';
      const metaStr =
        Object.keys(meta).length > 0
          ? `\n${JSON.stringify(meta, null, 2)}`
          : '';

      return `${timestamp} ${level} ${contextStr}${correlationStr}${userStr} ${message}${metaStr}`;
    },
  ),
);

/**
 * Create Winston configuration based on environment
 */
export function createWinstonConfig(): WinstonModuleOptions {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  // Base transports
  const transports: winston.transport[] = [];

  // Console transport (always present)
  transports.push(
    new winston.transports.Console({
      level: isDevelopment ? 'debug' : 'info',
      format: isDevelopment ? devFormat : logFormat,
      silent: isTest, // Silence logs during testing
    }),
  );

  // File transports for production
  if (!isDevelopment && !isTest) {
    // Application logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/library-service.log',
        level: 'info',
        format: logFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        tailable: true,
      }),
    );

    // Error logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/library-service-error.log',
        level: 'error',
        format: logFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true,
      }),
    );

    // Performance logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/library-service-performance.log',
        level: 'warn',
        format: logFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true,
      }),
    );
  }

  return {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    format: logFormat,
    transports,
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
  };
}

/**
 * Custom logger class with enhanced features
 */
export class StructuredLogger {
  private logger: winston.Logger;

  constructor(context?: string) {
    this.logger = winston.createLogger(createWinstonConfig());
    if (context) {
      this.logger = this.logger.child({ context });
    }
  }

  /**
   * Log with correlation ID and user context
   */
  logWithContext(
    level: string,
    message: string,
    meta: {
      correlationId?: string;
      userId?: string;
      duration?: number;
      statusCode?: number;
      error?: Error;
      [key: string]: any;
    } = {},
  ): void {
    this.logger.log(level, message, meta);
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    meta: {
      correlationId?: string;
      userId?: string;
      [key: string]: any;
    } = {},
  ): void {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logWithContext(level, `Performance: ${operation}`, {
      ...meta,
      duration,
      performanceMetric: true,
    });
  }

  /**
   * Log business events
   */
  logBusinessEvent(
    event: string,
    meta: {
      correlationId?: string;
      userId?: string;
      [key: string]: any;
    } = {},
  ): void {
    this.logWithContext('info', `Business Event: ${event}`, {
      ...meta,
      businessEvent: true,
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    event: string,
    meta: {
      correlationId?: string;
      userId?: string;
      ip?: string;
      userAgent?: string;
      [key: string]: any;
    } = {},
  ): void {
    this.logWithContext('warn', `Security Event: ${event}`, {
      ...meta,
      securityEvent: true,
    });
  }

  /**
   * Log API calls to external services
   */
  logExternalCall(
    service: string,
    method: string,
    url: string,
    duration: number,
    statusCode: number,
    meta: {
      correlationId?: string;
      [key: string]: any;
    } = {},
  ): void {
    const level =
      statusCode >= 400 ? 'error' : duration > 2000 ? 'warn' : 'info';
    this.logWithContext(level, `External Call: ${service} ${method} ${url}`, {
      ...meta,
      service,
      method,
      url,
      duration,
      statusCode,
      externalCall: true,
    });
  }
}

/**
 * Log levels configuration
 */
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
} as const;

/**
 * Performance thresholds for logging
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_REQUEST: 1000, // 1 second
  VERY_SLOW_REQUEST: 5000, // 5 seconds
  SLOW_DATABASE_QUERY: 500, // 500ms
  SLOW_EXTERNAL_CALL: 2000, // 2 seconds
} as const;
