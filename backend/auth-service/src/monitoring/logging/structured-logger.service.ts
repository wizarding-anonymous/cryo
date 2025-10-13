import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CorrelationService } from './correlation.service';

export interface LogContext {
  operation?: string;
  userId?: string;
  sessionId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: Error | string;
  metadata?: Record<string, any>;
  category?: string;
  service?: string;
  entity?: string;
  event?: string;
  ipAddress?: string;
  state?: string;
  userAgent?: string;
  channelId?: string;
  channelType?: string;
  alertRuleId?: string;
  alertCount?: number;
  severity?: string;
}

export interface SecurityLogContext extends LogContext {
  securityEvent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  attemptCount?: number;
  blocked?: boolean;
}

export interface AuthLogContext extends LogContext {
  authOperation: string;
  success: boolean;
  failureReason?: string;
  tokenType?: string;
  sessionCount?: number;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly correlationService: CorrelationService,
  ) {}

  /**
   * Log with structured format including correlation context
   */
  private logWithContext(level: string, message: string, context?: LogContext): void {
    const correlationContext = this.correlationService.getContext();
    
    const logData = {
      message,
      level,
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      correlationId: correlationContext?.correlationId,
      requestId: correlationContext?.requestId,
      userId: context?.userId || correlationContext?.userId,
      sessionId: context?.sessionId || correlationContext?.sessionId,
      ipAddress: correlationContext?.ipAddress,
      userAgent: correlationContext?.userAgent,
      duration: context?.duration || this.correlationService.getRequestDuration(),
      ...context,
    };

    // Remove undefined values
    Object.keys(logData).forEach(key => {
      if (logData[key] === undefined) {
        delete logData[key];
      }
    });

    this.logger.log(level, message, logData);
  }

  log(message: string, context?: LogContext): void {
    this.logWithContext('info', message, context);
  }

  error(message: string, error?: Error | string, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.logWithContext('error', message, errorContext);
  }

  warn(message: string, context?: LogContext): void {
    this.logWithContext('warn', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logWithContext('debug', message, context);
  }

  verbose(message: string, context?: LogContext): void {
    this.logWithContext('verbose', message, context);
  }

  /**
   * Log authentication operations
   */
  logAuth(message: string, context: AuthLogContext): void {
    this.logWithContext('info', message, {
      ...context,
      category: 'authentication',
    });
  }

  /**
   * Log security events
   */
  logSecurity(message: string, context: SecurityLogContext): void {
    const level = context.severity === 'critical' ? 'error' : 
                 context.severity === 'high' ? 'warn' : 'info';
    
    this.logWithContext(level, message, {
      ...context,
      category: 'security',
    });
  }

  /**
   * Log external service calls
   */
  logExternalService(message: string, service: string, operation: string, context?: LogContext): void {
    this.logWithContext('info', message, {
      ...context,
      category: 'external-service',
      service,
      operation,
    });
  }

  /**
   * Log database operations
   */
  logDatabase(message: string, entity: string, operation: string, context?: LogContext): void {
    this.logWithContext('debug', message, {
      ...context,
      category: 'database',
      entity,
      operation,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(message: string, operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    
    this.logWithContext(level, message, {
      ...context,
      category: 'performance',
      operation,
      duration,
    });
  }

  /**
   * Log business events
   */
  logBusiness(message: string, event: string, context?: LogContext): void {
    this.logWithContext('info', message, {
      ...context,
      category: 'business',
      event,
    });
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(message: string, endpoint: string, ipAddress: string, context?: LogContext): void {
    this.logWithContext('warn', message, {
      ...context,
      category: 'rate-limit',
      endpoint,
      ipAddress,
    });
  }

  /**
   * Log circuit breaker events
   */
  logCircuitBreaker(message: string, service: string, state: string, context?: LogContext): void {
    const level = state === 'open' ? 'error' : 'info';
    
    this.logWithContext(level, message, {
      ...context,
      category: 'circuit-breaker',
      service,
      state,
    });
  }
}