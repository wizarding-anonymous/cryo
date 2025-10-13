import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  startTime?: number;
}

@Injectable()
export class CorrelationService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Run code within a correlation context
   */
  run<T>(context: Partial<CorrelationContext>, callback: () => T): T {
    const fullContext: CorrelationContext = {
      correlationId: context.correlationId || this.generateCorrelationId(),
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      startTime: context.startTime || Date.now(),
    };

    return this.asyncLocalStorage.run(fullContext, callback);
  }

  /**
   * Get current correlation context
   */
  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get correlation ID from current context
   */
  getCorrelationId(): string | undefined {
    return this.getContext()?.correlationId;
  }

  /**
   * Get user ID from current context
   */
  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  /**
   * Get session ID from current context
   */
  getSessionId(): string | undefined {
    return this.getContext()?.sessionId;
  }

  /**
   * Update context with additional information
   */
  updateContext(updates: Partial<CorrelationContext>): void {
    const currentContext = this.getContext();
    if (currentContext) {
      Object.assign(currentContext, updates);
    }
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return `auth-${uuidv4()}`;
  }

  /**
   * Generate a new request ID
   */
  generateRequestId(): string {
    return `req-${uuidv4()}`;
  }

  /**
   * Get request duration in milliseconds
   */
  getRequestDuration(): number | undefined {
    const context = this.getContext();
    if (context?.startTime) {
      return Date.now() - context.startTime;
    }
    return undefined;
  }

  /**
   * Create correlation context from HTTP request
   */
  createContextFromRequest(req: any): Partial<CorrelationContext> {
    return {
      correlationId: req.headers['x-correlation-id'] || this.generateCorrelationId(),
      requestId: req.headers['x-request-id'] || this.generateRequestId(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      startTime: Date.now(),
    };
  }
}