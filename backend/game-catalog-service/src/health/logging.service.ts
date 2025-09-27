import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

export interface LogContext {
  userId?: string;
  requestId?: string;
  gameId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

@Injectable()
export class LoggingService {
  private readonly logger: winston.Logger;
  private readonly nestLogger = new Logger(LoggingService.name);

  constructor(private readonly configService: ConfigService) {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // Configure Winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        nodeEnv === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
      ),
      defaultMeta: {
        service: 'game-catalog-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: nodeEnv,
      },
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
    });

    // Add file transport for production
    if (nodeEnv === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      );
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      );
    }

    this.nestLogger.log('Logging service initialized');
  }

  /**
   * Log HTTP request
   */
  logHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'http_request',
      method,
      url,
      statusCode,
      duration,
      ...context,
    };

    if (statusCode >= 400) {
      this.logger.warn('HTTP request completed with error', logData);
    } else {
      this.logger.info('HTTP request completed', logData);
    }
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: string,
    duration: number,
    success: boolean,
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'database_operation',
      operation,
      duration,
      success,
      ...context,
    };

    if (success) {
      this.logger.debug('Database operation completed', logData);
    } else {
      this.logger.error('Database operation failed', logData);
    }
  }

  /**
   * Log cache operation
   */
  logCacheOperation(
    operation: string,
    cacheKey: string,
    hit: boolean,
    duration?: number,
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'cache_operation',
      operation,
      cacheKey,
      hit,
      duration,
      ...context,
    };

    this.logger.debug('Cache operation', logData);
  }

  /**
   * Log business operation
   */
  logBusinessOperation(
    operation: string,
    success: boolean,
    duration: number,
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'business_operation',
      operation,
      success,
      duration,
      ...context,
    };

    if (success) {
      this.logger.info('Business operation completed', logData);
    } else {
      this.logger.warn('Business operation failed', logData);
    }
  }

  /**
   * Log health check
   */
  logHealthCheck(
    checkType: string,
    status: 'up' | 'down',
    duration: number,
    details?: any,
  ): void {
    const logData = {
      type: 'health_check',
      checkType,
      status,
      duration,
      details,
    };

    if (status === 'up') {
      this.logger.info('Health check passed', logData);
    } else {
      this.logger.error('Health check failed', logData);
    }
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'security_event',
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...context,
    };

    switch (severity) {
      case 'critical':
      case 'high':
        this.logger.error('Security event detected', logData);
        break;
      case 'medium':
        this.logger.warn('Security event detected', logData);
        break;
      case 'low':
        this.logger.info('Security event detected', logData);
        break;
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    operation: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      cpuUsage?: number;
      [key: string]: any;
    },
    context: LogContext = {},
  ): void {
    const logData = {
      type: 'performance_metrics',
      operation,
      metrics,
      ...context,
    };

    this.logger.info('Performance metrics', logData);
  }

  /**
   * Log error with full context
   */
  logError(error: Error, operation: string, context: LogContext = {}): void {
    const logData = {
      type: 'error',
      operation,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    };

    this.logger.error('Operation failed with error', logData);
  }

  /**
   * Log application startup
   */
  logStartup(port: number, environment: string): void {
    this.logger.info('Game Catalog Service started', {
      type: 'startup',
      port,
      environment,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log application shutdown
   */
  logShutdown(reason: string): void {
    this.logger.info('Game Catalog Service shutting down', {
      type: 'shutdown',
      reason,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get Winston logger instance for advanced usage
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}
