import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface PaymentLogContext {
  paymentId?: string;
  orderId?: string;
  userId?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  status?: string;
  correlationId?: string;
  operation?: string;
  externalId?: string;
}

export interface AuditLogData extends PaymentLogContext {
  action: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentLoggerService {
  private readonly logger = new Logger(PaymentLoggerService.name);
  private readonly auditLogger = new Logger('PaymentAudit');
  private readonly securityLogger = new Logger('PaymentSecurity');

  constructor(private readonly als: AsyncLocalStorage<any>) {}

  /**
   * Log payment operation with context
   */
  logPaymentOperation(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: PaymentLogContext,
    error?: Error,
  ): void {
    const correlationId = this.getCorrelationId();
    const logContext = {
      ...context,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    const logMessage = this.formatLogMessage(message, logContext);

    switch (level) {
      case 'debug':
        this.logger.debug(logMessage, error?.stack);
        break;
      case 'info':
        this.logger.log(logMessage);
        break;
      case 'warn':
        this.logger.warn(logMessage, error?.stack);
        break;
      case 'error':
        this.logger.error(logMessage, error?.stack);
        break;
    }
  }

  /**
   * Log payment creation
   */
  logPaymentCreated(context: PaymentLogContext): void {
    this.logPaymentOperation('info', 'Payment created', {
      ...context,
      operation: 'create',
    });

    this.logAudit({
      ...context,
      action: 'payment_created',
      timestamp: new Date(),
    });
  }

  /**
   * Log payment processing start
   */
  logPaymentProcessingStarted(context: PaymentLogContext): void {
    this.logPaymentOperation('info', 'Payment processing started', {
      ...context,
      operation: 'process_start',
    });

    this.logAudit({
      ...context,
      action: 'payment_processing_started',
      timestamp: new Date(),
    });
  }

  /**
   * Log payment confirmation
   */
  logPaymentConfirmed(context: PaymentLogContext): void {
    this.logPaymentOperation('info', 'Payment confirmed successfully', {
      ...context,
      operation: 'confirm',
    });

    this.logAudit({
      ...context,
      action: 'payment_confirmed',
      timestamp: new Date(),
      previousStatus: 'processing',
      newStatus: 'completed',
    });
  }

  /**
   * Log payment cancellation
   */
  logPaymentCancelled(context: PaymentLogContext, reason?: string): void {
    this.logPaymentOperation('warn', 'Payment cancelled', {
      ...context,
      operation: 'cancel',
    });

    this.logAudit({
      ...context,
      action: 'payment_cancelled',
      timestamp: new Date(),
      reason,
      previousStatus: context.status,
      newStatus: 'cancelled',
    });
  }

  /**
   * Log payment failure
   */
  logPaymentFailed(
    context: PaymentLogContext,
    error: Error,
    reason?: string,
  ): void {
    this.logPaymentOperation(
      'error',
      'Payment failed',
      {
        ...context,
        operation: 'fail',
      },
      error,
    );

    this.logAudit({
      ...context,
      action: 'payment_failed',
      timestamp: new Date(),
      reason: reason || error.message,
      previousStatus: context.status,
      newStatus: 'failed',
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  }

  /**
   * Log order creation
   */
  logOrderCreated(context: PaymentLogContext): void {
    this.logPaymentOperation('info', 'Order created', {
      ...context,
      operation: 'order_create',
    });

    this.logAudit({
      ...context,
      action: 'order_created',
      timestamp: new Date(),
    });
  }

  /**
   * Log external provider interaction
   */
  logProviderInteraction(
    provider: string,
    operation: string,
    success: boolean,
    context?: PaymentLogContext,
    error?: Error,
  ): void {
    const level = success ? 'info' : 'error';
    const message = `Provider ${provider} ${operation} ${success ? 'succeeded' : 'failed'}`;

    this.logPaymentOperation(
      level,
      message,
      {
        ...context,
        provider,
        operation: `provider_${operation}`,
      },
      error,
    );
  }

  /**
   * Log webhook received
   */
  logWebhookReceived(
    provider: string,
    webhookData: any,
    context?: PaymentLogContext,
  ): void {
    this.logPaymentOperation('info', `Webhook received from ${provider}`, {
      ...context,
      provider,
      operation: 'webhook_received',
    });

    // Log webhook for audit (without sensitive data)
    this.logAudit({
      ...context,
      action: 'webhook_received',
      timestamp: new Date(),
      provider,
      metadata: {
        webhookType: webhookData.type || 'unknown',
        externalId: webhookData.externalId,
        // Don't log full webhook data for security
      },
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: PaymentLogContext & {
      ipAddress?: string;
      userAgent?: string;
      details?: Record<string, any>;
    },
  ): void {
    const message = `Security event: ${event}`;

    this.securityLogger.warn(message, {
      severity,
      ...context,
      timestamp: new Date().toISOString(),
    });

    // Also log to audit
    this.logAudit({
      ...context,
      action: `security_${event}`,
      timestamp: new Date(),
      metadata: {
        severity,
        ...context?.details,
      },
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    operation: string,
    duration: number,
    context?: PaymentLogContext,
  ): void {
    this.logPaymentOperation(
      'debug',
      `Operation ${operation} completed in ${duration}ms`,
      {
        ...context,
        operation: `perf_${operation}`,
      },
    );
  }

  /**
   * Log integration events (Library Service, Game Catalog Service)
   */
  logIntegrationEvent(
    service: string,
    operation: string,
    success: boolean,
    context?: PaymentLogContext,
    error?: Error,
  ): void {
    const level = success ? 'info' : 'error';
    const message = `Integration with ${service} ${operation} ${success ? 'succeeded' : 'failed'}`;

    this.logPaymentOperation(
      level,
      message,
      {
        ...context,
        operation: `integration_${service}_${operation}`,
      },
      error,
    );
  }

  /**
   * Private method to log audit events
   */
  private logAudit(data: AuditLogData): void {
    const auditEntry = {
      ...data,
      service: 'payment-service',
      version: process.env.npm_package_version || '1.0.0',
      audit: true, // Flag for audit log transport
    };

    this.auditLogger.log(JSON.stringify(auditEntry));
  }

  /**
   * Get correlation ID from async local storage
   */
  private getCorrelationId(): string | undefined {
    const store = this.als.getStore();
    return store?.correlationId;
  }

  /**
   * Format log message with context
   */
  private formatLogMessage(
    message: string,
    context: PaymentLogContext,
  ): string {
    const parts = [message];

    if (context.paymentId) {
      parts.push(`[Payment: ${context.paymentId}]`);
    }

    if (context.orderId) {
      parts.push(`[Order: ${context.orderId}]`);
    }

    if (context.userId) {
      parts.push(`[User: ${context.userId}]`);
    }

    if (context.provider) {
      parts.push(`[Provider: ${context.provider}]`);
    }

    if (context.amount && context.currency) {
      parts.push(`[Amount: ${context.amount} ${context.currency}]`);
    }

    return parts.join(' ');
  }

  /**
   * Create a child logger with payment context
   */
  createContextLogger(context: PaymentLogContext): PaymentContextLogger {
    return new PaymentContextLogger(this, context);
  }
}

/**
 * Context-aware logger for specific payment operations
 */
export class PaymentContextLogger {
  constructor(
    private readonly paymentLogger: PaymentLoggerService,
    private readonly context: PaymentLogContext,
  ) {}

  debug(message: string, additionalContext?: Partial<PaymentLogContext>): void {
    this.paymentLogger.logPaymentOperation('debug', message, {
      ...this.context,
      ...additionalContext,
    });
  }

  info(message: string, additionalContext?: Partial<PaymentLogContext>): void {
    this.paymentLogger.logPaymentOperation('info', message, {
      ...this.context,
      ...additionalContext,
    });
  }

  warn(
    message: string,
    additionalContext?: Partial<PaymentLogContext>,
    error?: Error,
  ): void {
    this.paymentLogger.logPaymentOperation(
      'warn',
      message,
      {
        ...this.context,
        ...additionalContext,
      },
      error,
    );
  }

  error(
    message: string,
    error?: Error,
    additionalContext?: Partial<PaymentLogContext>,
  ): void {
    this.paymentLogger.logPaymentOperation(
      'error',
      message,
      {
        ...this.context,
        ...additionalContext,
      },
      error,
    );
  }
}
