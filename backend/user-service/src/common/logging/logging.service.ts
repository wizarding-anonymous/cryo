import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation: string;
  duration?: number;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  userId?: string;
  operation: string;
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

@Injectable()
export class LoggingService {
  private readonly logger: winston.Logger;
  private readonly serviceName = 'user-service';
  private readonly serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  private readonly environment = process.env.NODE_ENV || 'development';

  private readonly sensitiveFields = [
    'password',
    'secret',
    'key',
    'token',
    'authorization',
    'currentPassword',
    'newPassword',
    'confirmPassword',
    'jwt',
    'refresh_token',
    'access_token',
  ];

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: {
        service: this.serviceName,
        version: this.serviceVersion,
        environment: this.environment,
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
        // HTTP transport for Logstash
        new winston.transports.Http({
          host: process.env.LOGSTASH_HOST || 'logstash',
          port: parseInt(process.env.LOGSTASH_PORT || '8080'),
          path: '/logs',
          format: winston.format.json(),
        }),
      ],
    });
  }

  /**
   * Sanitizes data by removing or masking sensitive fields
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized = { ...data };

    for (const field of this.sensitiveFields) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Creates a structured log entry
   */
  private createLogEntry(
    level: string,
    message: string,
    context: LogContext,
    error?: Error,
  ): StructuredLogEntry {
    const sanitizedMetadata = context.metadata
      ? this.sanitizeData(context.metadata)
      : undefined;

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.serviceVersion,
      environment: this.environment,
      correlationId: context.correlationId,
      userId: context.userId,
      operation: context.operation,
      duration: context.duration,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: sanitizedMetadata,
      stack: error?.stack,
    };
  }

  /**
   * Logs an info message with structured context
   */
  info(message: string, context: LogContext): void {
    const logEntry = this.createLogEntry('info', message, context);
    this.logger.info(logEntry);
  }

  /**
   * Logs a debug message with structured context
   */
  debug(message: string, context: LogContext): void {
    const logEntry = this.createLogEntry('debug', message, context);
    this.logger.debug(logEntry);
  }

  /**
   * Logs a warning message with structured context
   */
  warn(message: string, context: LogContext): void {
    const logEntry = this.createLogEntry('warn', message, context);
    this.logger.warn(logEntry);
  }

  /**
   * Logs an error message with structured context
   */
  error(message: string, context: LogContext, error?: Error): void {
    const logEntry = this.createLogEntry('error', message, context, error);
    this.logger.error(logEntry);
  }

  /**
   * Logs user operation with performance metrics
   */
  logUserOperation(
    operation: string,
    userId: string,
    correlationId: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>,
  ): void {
    const message = `User operation ${operation} ${success ? 'completed' : 'failed'}`;
    const context: LogContext = {
      correlationId,
      userId,
      operation,
      duration,
      metadata: {
        ...metadata,
        success,
      },
    };

    if (success) {
      this.info(message, context);
    } else {
      this.warn(message, context);
    }
  }

  /**
   * Logs database operation with performance metrics
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    correlationId: string,
    duration: number,
    success: boolean,
    recordCount?: number,
    error?: Error,
  ): void {
    const message = `Database ${operation} on ${table} ${success ? 'completed' : 'failed'}`;
    const context: LogContext = {
      correlationId,
      operation: `db_${operation}`,
      duration,
      metadata: {
        table,
        recordCount,
        success,
      },
    };

    if (success) {
      this.info(message, context);
    } else {
      this.error(message, context, error);
    }
  }

  /**
   * Logs cache operation with performance metrics
   */
  logCacheOperation(
    operation: string,
    key: string,
    correlationId: string,
    duration: number,
    hit: boolean,
    metadata?: Record<string, any>,
  ): void {
    const message = `Cache ${operation} for key ${key} - ${hit ? 'HIT' : 'MISS'}`;
    const context: LogContext = {
      correlationId,
      operation: `cache_${operation}`,
      duration,
      metadata: {
        key,
        hit,
        ...metadata,
      },
    };

    this.debug(message, context);
  }

  /**
   * Logs external service call with performance metrics
   */
  logExternalServiceCall(
    serviceName: string,
    operation: string,
    correlationId: string,
    duration: number,
    success: boolean,
    statusCode?: number,
    error?: Error,
  ): void {
    const message = `External service call to ${serviceName} ${success ? 'completed' : 'failed'}`;
    const context: LogContext = {
      correlationId,
      operation: `external_${operation}`,
      duration,
      metadata: {
        serviceName,
        statusCode,
        success,
      },
    };

    if (success) {
      this.info(message, context);
    } else {
      this.error(message, context, error);
    }
  }

  /**
   * Logs security event
   */
  logSecurityEvent(
    event: string,
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>,
  ): void {
    const message = `Security event: ${event}`;
    const context: LogContext = {
      correlationId,
      userId,
      operation: 'security_event',
      ipAddress,
      userAgent,
      metadata: {
        event,
        severity,
        ...metadata,
      },
    };

    switch (severity) {
      case 'low':
      case 'medium':
        this.info(message, context);
        break;
      case 'high':
        this.warn(message, context);
        break;
      case 'critical':
        this.error(message, context);
        break;
    }
  }

  /**
   * Extracts context from Express request
   */
  extractRequestContext(request: Request): Partial<LogContext> {
    return {
      correlationId: (request as any).correlationId,
      userId: (request as any).user?.id,
      ipAddress: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
      requestId: (request as any).id,
    };
  }

  /**
   * Creates a child logger with additional context
   */
  createChildLogger(baseContext: Partial<LogContext>): LoggingService {
    const childLogger = new LoggingService();

    // Override methods to include base context
    const originalInfo = childLogger.info.bind(childLogger);
    const originalDebug = childLogger.debug.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalError = childLogger.error.bind(childLogger);

    childLogger.info = (message: string, context: LogContext) => {
      originalInfo(message, { ...baseContext, ...context });
    };

    childLogger.debug = (message: string, context: LogContext) => {
      originalDebug(message, { ...baseContext, ...context });
    };

    childLogger.warn = (message: string, context: LogContext) => {
      originalWarn(message, { ...baseContext, ...context });
    };

    childLogger.error = (
      message: string,
      context: LogContext,
      error?: Error,
    ) => {
      originalError(message, { ...baseContext, ...context }, error);
    };

    return childLogger;
  }
}
