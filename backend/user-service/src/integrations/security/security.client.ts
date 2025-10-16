import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SecurityEvent {
  userId: string;
  type:
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DELETED'
    | 'PROFILE_UPDATED'
    | 'DATA_ACCESS'
    | 'SUSPICIOUS_ACTIVITY'
    | 'COMPLIANCE_EVENT'
    | 'AUTHENTICATION_EVENT'
    | 'ADMIN_ACTION';
  ipAddress: string;
  timestamp: Date;
  details?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  correlationId?: string;
  riskScore?: number;
}

interface AuditTrail {
  userId: string;
  operation: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  correlationId: string;
  success: boolean;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ComplianceReport {
  reportType: 'GDPR_ACCESS_LOG' | 'PCI_AUDIT_TRAIL' | 'HIPAA_ACCESS_LOG' | 'SOX_COMPLIANCE';
  userId: string;
  dataSubject?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  events: AuditTrail[];
  summary: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    dataCategories: string[];
  };
}

@Injectable()
export class SecurityClient {
  private readonly logger = new Logger(SecurityClient.name);
  private readonly securityServiceUrl: string;
  private readonly apiKey: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(private readonly configService: ConfigService) {
    this.securityServiceUrl = this.configService.get<string>('SECURITY_SERVICE_URL', 'http://security-service:3000');
    this.apiKey = this.configService.get<string>('SECURITY_SERVICE_API_KEY', 'mock-api-key');
  }

  /**
   * Sends a security event to the Security Service with retry logic
   * @param event The security event to log
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const sanitizedEvent = this.sanitizeEventForLogging(event);
    
    this.logger.log(
      `Logging security event of type "${event.type}" to Security Service for user ${event.userId}...`,
    );

    try {
      await this.sendWithRetry('/api/v1/security/events', sanitizedEvent);
      
      this.logger.log(
        `Successfully logged security event for user ${event.userId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log security event for user ${event.userId}: ${error.message}`,
        error.stack,
      );
      
      // Don't throw the error to prevent breaking the main application flow
      // Security logging failures should be logged but not block operations
    }
  }

  /**
   * Sends an audit trail to the Security Service for centralized storage
   * @param auditTrail The audit trail to send
   */
  async sendAuditTrail(auditTrail: AuditTrail): Promise<void> {
    const sanitizedTrail = this.sanitizeAuditTrail(auditTrail);
    
    this.logger.debug(
      `Sending audit trail for operation "${auditTrail.operation}" by user ${auditTrail.userId}`,
    );

    try {
      await this.sendWithRetry('/api/v1/audit/trails', sanitizedTrail);
      
      this.logger.debug(
        `Successfully sent audit trail for user ${auditTrail.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send audit trail for user ${auditTrail.userId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Requests a compliance report from the Security Service
   * @param reportType The type of compliance report
   * @param userId The user requesting the report
   * @param dataSubject The subject of the data (for GDPR requests)
   * @param timeRange The time range for the report
   */
  async requestComplianceReport(
    reportType: ComplianceReport['reportType'],
    userId: string,
    dataSubject?: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<ComplianceReport | null> {
    this.logger.log(
      `Requesting ${reportType} compliance report for user ${userId}`,
    );

    try {
      const payload = {
        reportType,
        userId,
        dataSubject,
        timeRange: timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },
      };

      const response = await this.sendWithRetry('/api/v1/compliance/reports', payload, 'POST');
      
      this.logger.log(
        `Successfully generated ${reportType} compliance report for user ${userId}`,
      );

      return response as ComplianceReport;
    } catch (error) {
      this.logger.error(
        `Failed to generate compliance report for user ${userId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Reports suspicious activity to the Security Service for immediate action
   * @param activity The suspicious activity details
   */
  async reportSuspiciousActivity(activity: {
    userId: string;
    activityType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    ipAddress: string;
    userAgent: string;
    correlationId: string;
    details: Record<string, any>;
  }): Promise<void> {
    this.logger.warn(
      `Reporting suspicious activity: ${activity.activityType} (Risk: ${activity.riskScore}) for user ${activity.userId}`,
    );

    const securityEvent: SecurityEvent = {
      userId: activity.userId,
      type: 'SUSPICIOUS_ACTIVITY',
      ipAddress: activity.ipAddress,
      timestamp: new Date(),
      severity: activity.severity,
      correlationId: activity.correlationId,
      riskScore: activity.riskScore,
      details: {
        activityType: activity.activityType,
        userAgent: activity.userAgent,
        ...activity.details,
      },
    };

    await this.logSecurityEvent(securityEvent);

    // For high-risk activities, also send immediate alert
    if (activity.riskScore >= 70) {
      try {
        await this.sendWithRetry('/api/v1/security/alerts', {
          userId: activity.userId,
          alertType: 'HIGH_RISK_ACTIVITY',
          severity: activity.severity,
          riskScore: activity.riskScore,
          activityType: activity.activityType,
          ipAddress: activity.ipAddress,
          correlationId: activity.correlationId,
          timestamp: new Date(),
          requiresImmediateAction: activity.riskScore >= 90,
        });

        this.logger.warn(
          `High-risk activity alert sent for user ${activity.userId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send high-risk activity alert: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Sends data with retry logic
   * @param endpoint The API endpoint
   * @param data The data to send
   * @param method The HTTP method
   */
  private async sendWithRetry(
    endpoint: string,
    data: any,
    method: 'POST' | 'GET' = 'POST',
  ): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // In a real implementation, this would be an actual HTTP call
        // For now, we'll simulate the call and log the data
        
        this.logger.debug(
          `[MOCK] ${method} ${this.securityServiceUrl}${endpoint} (Attempt ${attempt}/${this.retryAttempts})`,
        );
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate occasional failures for testing retry logic
        if (Math.random() < 0.1 && attempt < this.retryAttempts) {
          throw new Error('Simulated network error');
        }

        this.logger.debug(
          `[MOCK] Successfully sent data to Security Service: ${JSON.stringify(data, null, 2)}`,
        );

        return { success: true, data };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed after ${this.retryAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Sanitizes security event data for safe logging and transmission
   * @param event The security event to sanitize
   * @returns Sanitized event data
   */
  private sanitizeEventForLogging(event: SecurityEvent): any {
    const sanitized = {
      userId: event.userId,
      type: event.type,
      ipAddress: event.ipAddress,
      timestamp: event.timestamp,
      severity: event.severity,
      correlationId: event.correlationId,
      riskScore: event.riskScore,
      details: event.details ? this.sanitizeDetails(event.details) : undefined,
    };

    return sanitized;
  }

  /**
   * Sanitizes audit trail data
   * @param auditTrail The audit trail to sanitize
   * @returns Sanitized audit trail
   */
  private sanitizeAuditTrail(auditTrail: AuditTrail): any {
    return {
      userId: auditTrail.userId,
      operation: auditTrail.operation,
      resource: auditTrail.resource,
      resourceId: auditTrail.resourceId,
      timestamp: auditTrail.timestamp,
      ipAddress: auditTrail.ipAddress,
      userAgent: auditTrail.userAgent,
      correlationId: auditTrail.correlationId,
      success: auditTrail.success,
      changes: auditTrail.changes ? this.sanitizeDetails(auditTrail.changes) : undefined,
      metadata: auditTrail.metadata ? this.sanitizeDetails(auditTrail.metadata) : undefined,
    };
  }

  /**
   * Sanitizes details object by removing sensitive fields
   * @param details The details object to sanitize
   * @returns Sanitized details
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveFields = [
      'password', 'secret', 'key', 'token', 'authorization',
      'currentPassword', 'newPassword', 'confirmPassword',
      'jwt', 'refresh_token', 'access_token', 'apiKey',
      'creditCard', 'ssn', 'socialSecurityNumber',
    ];

    const sanitized = { ...details };

    for (const field of sensitiveFields) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitizeDetails(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Health check for Security Service connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    const startTime = Date.now();
    
    try {
      await this.sendWithRetry('/api/v1/health', {}, 'GET');
      const latency = Date.now() - startTime;
      
      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error(`Security Service health check failed: ${error.message}`);
      return { status: 'unhealthy' };
    }
  }
}
