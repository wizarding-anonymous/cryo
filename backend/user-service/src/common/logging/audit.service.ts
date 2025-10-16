import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { LoggingService, LogContext } from './logging.service';
import { SecurityClient } from '../../integrations/security/security.client';

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  userId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DataAccessEvent {
  operation:
    | 'CREATE'
    | 'READ'
    | 'UPDATE'
    | 'DELETE'
    | 'BULK_READ'
    | 'BULK_UPDATE'
    | 'BULK_DELETE';
  table: string;
  recordId?: string;
  recordIds?: string[];
  userId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  fieldsAccessed?: string[];
  changes?: Record<string, { from: any; to: any }>;
  success: boolean;
  error?: string;
}

export interface SuspiciousActivity {
  type: 'MULTIPLE_FAILED_LOGINS' | 'UNUSUAL_ACCESS_PATTERN' | 'BULK_DATA_ACCESS' | 'CROSS_USER_ACCESS' | 'ADMIN_PRIVILEGE_ESCALATION' | 'SENSITIVE_DATA_MASS_ACCESS' | 'UNUSUAL_TIME_ACCESS' | 'GEOLOCATION_ANOMALY';
  userId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  riskScore: number; // 0-100
}

export interface ComplianceEvent {
  type: 'GDPR_DATA_ACCESS' | 'GDPR_DATA_EXPORT' | 'GDPR_DATA_DELETION' | 'PCI_DATA_ACCESS' | 'HIPAA_DATA_ACCESS' | 'SOX_AUDIT_TRAIL';
  userId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  dataSubject?: string; // The user whose data is being accessed
  legalBasis?: string;
  purpose: string;
  dataCategories: string[];
  retentionPeriod?: string;
  success: boolean;
}

@Injectable()
export class AuditService {
  private readonly suspiciousActivityThresholds = {
    FAILED_LOGIN_ATTEMPTS: 5,
    BULK_ACCESS_THRESHOLD: 100,
    CROSS_USER_ACCESS_THRESHOLD: 10,
    UNUSUAL_HOUR_START: 22, // 10 PM
    UNUSUAL_HOUR_END: 6,    // 6 AM
  };

  private readonly userActivityCache = new Map<string, any[]>();

  constructor(
    private readonly loggingService: LoggingService,
    @Inject(forwardRef(() => SecurityClient))
    private readonly securityClient: SecurityClient,
  ) {}

  /**
   * Logs a general audit event
   */
  logAuditEvent(event: AuditEvent): void {
    const context: LogContext = {
      correlationId: event.correlationId,
      userId: event.userId,
      operation: 'audit_event',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        success: event.success,
        changes: event.changes,
        ...event.metadata,
      },
    };

    const message = `Audit: ${event.action} on ${event.resource}${event.resourceId ? ` (${event.resourceId})` : ''} - ${event.success ? 'SUCCESS' : 'FAILED'}`;

    if (event.success) {
      this.loggingService.info(message, context);
    } else {
      this.loggingService.warn(message, context);
    }
  }

  /**
   * Logs data access events for compliance and security
   */
  logDataAccess(event: DataAccessEvent): void {
    const context: LogContext = {
      correlationId: event.correlationId,
      userId: event.userId,
      operation: 'data_access',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        operation: event.operation,
        table: event.table,
        recordId: event.recordId,
        recordIds: event.recordIds,
        fieldsAccessed: event.fieldsAccessed,
        changes: event.changes,
        success: event.success,
        error: event.error,
        recordCount: event.recordIds?.length || (event.recordId ? 1 : 0),
      },
    };

    const recordInfo = event.recordId
      ? `record ${event.recordId}`
      : event.recordIds
        ? `${event.recordIds.length} records`
        : 'records';

    const message = `Data Access: ${event.operation} on ${event.table} (${recordInfo}) - ${event.success ? 'SUCCESS' : 'FAILED'}`;

    if (event.success) {
      this.loggingService.info(message, context);
    } else {
      this.loggingService.error(message, context);
    }
  }

  /**
   * Logs user authentication events
   */
  logAuthenticationEvent(
    action:
      | 'LOGIN_ATTEMPT'
      | 'LOGIN_SUCCESS'
      | 'LOGIN_FAILED'
      | 'LOGOUT'
      | 'TOKEN_REFRESH'
      | 'PASSWORD_CHANGE',
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    metadata?: Record<string, any>,
  ): void {
    const event: AuditEvent = {
      action,
      resource: 'authentication',
      resourceId: userId,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      metadata,
    };

    this.logAuditEvent(event);

    // Log security events for failed authentication attempts
    if (!success && (action === 'LOGIN_ATTEMPT' || action === 'LOGIN_FAILED')) {
      this.loggingService.logSecurityEvent(
        'Failed authentication attempt',
        userId,
        correlationId,
        ipAddress,
        userAgent,
        'medium',
        {
          action,
          ...metadata,
        },
      );
    }
  }

  /**
   * Logs user profile access and modifications
   */
  logProfileAccess(
    operation: 'VIEW' | 'UPDATE' | 'DELETE',
    targetUserId: string,
    accessingUserId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    changes?: Record<string, any>,
    error?: string,
  ): void {
    const event: AuditEvent = {
      action: `PROFILE_${operation}`,
      resource: 'user_profile',
      resourceId: targetUserId,
      userId: accessingUserId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      changes,
      metadata: {
        targetUserId,
        accessingUserId,
        selfAccess: targetUserId === accessingUserId,
        error,
      },
    };

    this.logAuditEvent(event);

    // Log security event if someone is accessing another user's profile
    if (targetUserId !== accessingUserId) {
      this.loggingService.logSecurityEvent(
        'Cross-user profile access',
        accessingUserId,
        correlationId,
        ipAddress,
        userAgent,
        'low',
        {
          operation,
          targetUserId,
          success,
        },
      );
    }
  }

  /**
   * Logs sensitive data access (PII, financial data, etc.)
   */
  logSensitiveDataAccess(
    dataType: 'PII' | 'FINANCIAL' | 'HEALTH' | 'BIOMETRIC' | 'LOCATION',
    operation: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT',
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    recordId?: string,
    purpose?: string,
  ): void {
    const event: AuditEvent = {
      action: `SENSITIVE_DATA_${operation.toUpperCase()}`,
      resource: dataType.toLowerCase(),
      resourceId: recordId,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success: true,
      metadata: {
        dataType,
        operation,
        purpose,
      },
    };

    this.logAuditEvent(event);

    // Always log sensitive data access as security events
    this.loggingService.logSecurityEvent(
      `Sensitive data access: ${dataType}`,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      'medium',
      {
        dataType,
        operation,
        recordId,
        purpose,
      },
    );
  }

  /**
   * Logs administrative actions
   */
  logAdminAction(
    action: string,
    targetResource: string,
    targetResourceId: string,
    adminUserId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    changes?: Record<string, any>,
    error?: string,
  ): void {
    const event: AuditEvent = {
      action: `ADMIN_${action.toUpperCase()}`,
      resource: targetResource,
      resourceId: targetResourceId,
      userId: adminUserId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      changes,
      metadata: {
        adminAction: true,
        error,
      },
    };

    this.logAuditEvent(event);

    // Log all admin actions as security events
    this.loggingService.logSecurityEvent(
      `Administrative action: ${action}`,
      adminUserId,
      correlationId,
      ipAddress,
      userAgent,
      'high',
      {
        action,
        targetResource,
        targetResourceId,
        success,
        changes,
      },
    );
  }

  /**
   * Logs bulk operations for compliance
   */
  logBulkOperation(
    operation: 'EXPORT' | 'IMPORT' | 'DELETE' | 'UPDATE',
    table: string,
    recordCount: number,
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    criteria?: Record<string, any>,
    error?: string,
  ): void {
    const event: AuditEvent = {
      action: `BULK_${operation}`,
      resource: table,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      metadata: {
        recordCount,
        criteria,
        error,
      },
    };

    this.logAuditEvent(event);

    // Log large bulk operations as security events
    if (recordCount > 1000) {
      this.loggingService.logSecurityEvent(
        `Large bulk operation: ${operation}`,
        userId,
        correlationId,
        ipAddress,
        userAgent,
        'medium',
        {
          operation,
          table,
          recordCount,
          criteria,
        },
      );
    }
  }

  /**
   * Creates a data access event from database operation
   */
  createDataAccessEvent(
    operation: DataAccessEvent['operation'],
    table: string,
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    recordId?: string,
    recordIds?: string[],
    fieldsAccessed?: string[],
    changes?: Record<string, { from: any; to: any }>,
    error?: string,
  ): DataAccessEvent {
    return {
      operation,
      table,
      recordId,
      recordIds,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      fieldsAccessed,
      changes,
      success,
      error,
    };
  }

  /**
   * Enhanced data access logging with automatic suspicious activity detection
   */
  async logEnhancedDataAccess(event: DataAccessEvent): Promise<void> {
    // Log the standard data access event
    this.logDataAccess(event);

    // Send to Security Service for centralized audit
    try {
      await this.securityClient.logSecurityEvent({
        userId: event.userId,
        type: 'DATA_ACCESS',
        ipAddress: event.ipAddress,
        timestamp: new Date(),
        details: {
          operation: event.operation,
          table: event.table,
          recordId: event.recordId,
          recordIds: event.recordIds,
          fieldsAccessed: event.fieldsAccessed,
          changes: event.changes,
          success: event.success,
          error: event.error,
          recordCount: event.recordIds?.length || (event.recordId ? 1 : 0),
        },
      });
    } catch (error) {
      this.loggingService.error(
        'Failed to send data access event to Security Service',
        {
          correlationId: event.correlationId,
          userId: event.userId,
          operation: 'security_service_integration',
          metadata: { error: error.message },
        },
        error,
      );
    }

    // Check for suspicious activity patterns
    await this.detectSuspiciousActivity(event);
  }

  /**
   * Logs compliance-related events (GDPR, PCI, HIPAA, etc.)
   */
  async logComplianceEvent(event: ComplianceEvent): Promise<void> {
    const context: LogContext = {
      correlationId: event.correlationId,
      userId: event.userId,
      operation: 'compliance_event',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        type: event.type,
        dataSubject: event.dataSubject,
        legalBasis: event.legalBasis,
        purpose: event.purpose,
        dataCategories: event.dataCategories,
        retentionPeriod: event.retentionPeriod,
        success: event.success,
      },
    };

    const message = `Compliance Event: ${event.type} - ${event.purpose} - ${event.success ? 'SUCCESS' : 'FAILED'}`;

    if (event.success) {
      this.loggingService.info(message, context);
    } else {
      this.loggingService.error(message, context);
    }

    // Send to Security Service for compliance tracking
    try {
      await this.securityClient.logSecurityEvent({
        userId: event.userId,
        type: 'DATA_ACCESS',
        ipAddress: event.ipAddress,
        timestamp: event.timestamp,
        details: {
          complianceType: event.type,
          dataSubject: event.dataSubject,
          legalBasis: event.legalBasis,
          purpose: event.purpose,
          dataCategories: event.dataCategories,
          retentionPeriod: event.retentionPeriod,
          success: event.success,
        },
      });
    } catch (error) {
      this.loggingService.error(
        'Failed to send compliance event to Security Service',
        {
          correlationId: event.correlationId,
          userId: event.userId,
          operation: 'security_service_integration',
          metadata: { error: error.message },
        },
        error,
      );
    }
  }

  /**
   * Detects and logs suspicious activity patterns
   */
  private async detectSuspiciousActivity(event: DataAccessEvent): Promise<void> {
    const userId = event.userId;
    const now = new Date();

    // Get or create user activity history
    if (!this.userActivityCache.has(userId)) {
      this.userActivityCache.set(userId, []);
    }

    const userActivity = this.userActivityCache.get(userId);
    userActivity.push({
      timestamp: now,
      operation: event.operation,
      table: event.table,
      recordCount: event.recordIds?.length || (event.recordId ? 1 : 0),
      ipAddress: event.ipAddress,
      success: event.success,
    });

    // Keep only last 100 activities per user
    if (userActivity.length > 100) {
      userActivity.splice(0, userActivity.length - 100);
    }

    // Check for various suspicious patterns
    await this.checkBulkDataAccess(event, userActivity);
    await this.checkUnusualAccessPattern(event, userActivity);
    await this.checkUnusualTimeAccess(event);
    await this.checkCrossUserAccess(event);
  }

  /**
   * Checks for bulk data access patterns
   */
  private async checkBulkDataAccess(event: DataAccessEvent, userActivity: any[]): Promise<void> {
    const recordCount = event.recordIds?.length || (event.recordId ? 1 : 0);
    
    if (recordCount > this.suspiciousActivityThresholds.BULK_ACCESS_THRESHOLD) {
      await this.logSuspiciousActivity({
        type: 'BULK_DATA_ACCESS',
        userId: event.userId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date(),
        severity: recordCount > 1000 ? 'high' : 'medium',
        details: {
          operation: event.operation,
          table: event.table,
          recordCount,
          threshold: this.suspiciousActivityThresholds.BULK_ACCESS_THRESHOLD,
        },
        riskScore: Math.min(100, (recordCount / this.suspiciousActivityThresholds.BULK_ACCESS_THRESHOLD) * 50),
      });
    }
  }

  /**
   * Checks for unusual access patterns
   */
  private async checkUnusualAccessPattern(event: DataAccessEvent, userActivity: any[]): Promise<void> {
    const recentActivity = userActivity.filter(
      activity => new Date().getTime() - activity.timestamp.getTime() < 3600000 // Last hour
    );

    const uniqueTables = new Set(recentActivity.map(activity => activity.table));
    const totalRecords = recentActivity.reduce((sum, activity) => sum + activity.recordCount, 0);

    if (uniqueTables.size > 5 && totalRecords > 500) {
      await this.logSuspiciousActivity({
        type: 'UNUSUAL_ACCESS_PATTERN',
        userId: event.userId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date(),
        severity: 'medium',
        details: {
          uniqueTablesAccessed: uniqueTables.size,
          totalRecordsAccessed: totalRecords,
          timeWindow: '1 hour',
          activities: recentActivity.length,
        },
        riskScore: Math.min(100, (uniqueTables.size * 10) + (totalRecords / 100)),
      });
    }
  }

  /**
   * Checks for access during unusual hours
   */
  private async checkUnusualTimeAccess(event: DataAccessEvent): Promise<void> {
    const hour = new Date().getHours();
    
    if (hour >= this.suspiciousActivityThresholds.UNUSUAL_HOUR_START || 
        hour <= this.suspiciousActivityThresholds.UNUSUAL_HOUR_END) {
      await this.logSuspiciousActivity({
        type: 'UNUSUAL_TIME_ACCESS',
        userId: event.userId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date(),
        severity: 'low',
        details: {
          accessHour: hour,
          operation: event.operation,
          table: event.table,
          recordCount: event.recordIds?.length || (event.recordId ? 1 : 0),
        },
        riskScore: 25,
      });
    }
  }

  /**
   * Checks for cross-user data access
   */
  private async checkCrossUserAccess(event: DataAccessEvent): Promise<void> {
    // This would need to be enhanced with actual business logic to determine
    // if the accessed records belong to other users
    if (event.table === 'users' && event.operation === 'READ' && event.recordIds && event.recordIds.length > 1) {
      await this.logSuspiciousActivity({
        type: 'CROSS_USER_ACCESS',
        userId: event.userId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date(),
        severity: 'medium',
        details: {
          operation: event.operation,
          table: event.table,
          recordCount: event.recordIds.length,
          suspectedCrossUserAccess: true,
        },
        riskScore: 60,
      });
    }
  }

  /**
   * Logs suspicious activity and sends alerts
   */
  async logSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    const context: LogContext = {
      correlationId: activity.correlationId,
      userId: activity.userId,
      operation: 'suspicious_activity',
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      metadata: {
        type: activity.type,
        severity: activity.severity,
        riskScore: activity.riskScore,
        details: activity.details,
      },
    };

    const message = `SUSPICIOUS ACTIVITY DETECTED: ${activity.type} - Risk Score: ${activity.riskScore}`;

    switch (activity.severity) {
      case 'low':
        this.loggingService.info(message, context);
        break;
      case 'medium':
        this.loggingService.warn(message, context);
        break;
      case 'high':
      case 'critical':
        this.loggingService.error(message, context);
        break;
    }

    // Send to Security Service for immediate action
    try {
      await this.securityClient.logSecurityEvent({
        userId: activity.userId,
        type: 'DATA_ACCESS',
        ipAddress: activity.ipAddress,
        timestamp: activity.timestamp,
        details: {
          suspiciousActivity: true,
          activityType: activity.type,
          severity: activity.severity,
          riskScore: activity.riskScore,
          details: activity.details,
        },
      });

      // Also report as suspicious activity
      await this.securityClient.reportSuspiciousActivity({
        userId: activity.userId,
        activityType: activity.type,
        severity: activity.severity,
        riskScore: activity.riskScore,
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
        correlationId: activity.correlationId,
        details: activity.details,
      });
    } catch (error) {
      this.loggingService.error(
        'Failed to send suspicious activity alert to Security Service',
        {
          correlationId: activity.correlationId,
          userId: activity.userId,
          operation: 'security_service_integration',
          metadata: { error: error.message },
        },
        error,
      );
    }

    // For high-risk activities, also log as security events
    if (activity.riskScore >= 70) {
      this.loggingService.logSecurityEvent(
        `High-risk suspicious activity: ${activity.type}`,
        activity.userId,
        activity.correlationId,
        activity.ipAddress,
        activity.userAgent,
        activity.severity === 'critical' ? 'critical' : 'high',
        {
          riskScore: activity.riskScore,
          activityType: activity.type,
          details: activity.details,
        },
      );
    }
  }

  /**
   * Logs all user operations with enhanced context
   */
  async logUserOperation(
    operation: string,
    userId: string,
    correlationId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    duration?: number,
    metadata?: Record<string, any>,
    changes?: Record<string, { from: any; to: any }>,
  ): Promise<void> {
    // Standard audit event
    const auditEvent: AuditEvent = {
      action: operation,
      resource: 'user',
      resourceId: userId,
      userId,
      correlationId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success,
      changes,
      metadata: {
        duration,
        ...metadata,
      },
    };

    this.logAuditEvent(auditEvent);

    // Enhanced data access event if it involves data operations
    if (['CREATE', 'READ', 'UPDATE', 'DELETE'].some(op => operation.toUpperCase().includes(op))) {
      const dataAccessEvent: DataAccessEvent = {
        operation: this.mapOperationToDataAccess(operation),
        table: 'users',
        recordId: userId,
        userId,
        correlationId,
        ipAddress,
        userAgent,
        fieldsAccessed: metadata?.fieldsAccessed,
        changes,
        success,
        error: metadata?.error,
      };

      await this.logEnhancedDataAccess(dataAccessEvent);
    }

    // Log compliance event for GDPR-relevant operations
    if (this.isGDPRRelevantOperation(operation)) {
      const complianceEvent: ComplianceEvent = {
        type: 'GDPR_DATA_ACCESS',
        userId,
        correlationId,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        dataSubject: userId,
        purpose: this.getOperationPurpose(operation),
        dataCategories: ['personal_data', 'profile_data'],
        success,
      };

      await this.logComplianceEvent(complianceEvent);
    }
  }

  /**
   * Maps operation string to DataAccessEvent operation
   */
  private mapOperationToDataAccess(operation: string): DataAccessEvent['operation'] {
    const upperOp = operation.toUpperCase();
    
    // Check BULK operations first
    if (upperOp.includes('BULK')) {
      if (upperOp.includes('READ')) return 'BULK_READ';
      if (upperOp.includes('UPDATE')) return 'BULK_UPDATE';
      if (upperOp.includes('DELETE')) return 'BULK_DELETE';
    }
    
    // Then check regular operations
    if (upperOp.includes('CREATE')) return 'CREATE';
    if (upperOp.includes('READ') || upperOp.includes('GET') || upperOp.includes('FIND')) return 'READ';
    if (upperOp.includes('UPDATE') || upperOp.includes('PATCH')) return 'UPDATE';
    if (upperOp.includes('DELETE')) return 'DELETE';
    
    return 'READ'; // Default fallback
  }

  /**
   * Checks if operation is GDPR-relevant
   */
  private isGDPRRelevantOperation(operation: string): boolean {
    const gdprOperations = [
      'profile_view', 'profile_update', 'profile_delete',
      'user_create', 'user_update', 'user_delete',
      'data_export', 'data_download'
    ];
    return gdprOperations.some(gdprOp => operation.toLowerCase().includes(gdprOp));
  }

  /**
   * Gets the purpose of an operation for compliance logging
   */
  private getOperationPurpose(operation: string): string {
    const purposeMap: Record<string, string> = {
      'profile_view': 'User profile access',
      'profile_update': 'User profile modification',
      'profile_delete': 'User profile deletion',
      'user_create': 'User account creation',
      'user_update': 'User account modification',
      'user_delete': 'User account deletion',
      'data_export': 'Data portability request',
      'data_download': 'Data access request',
    };

    for (const [key, purpose] of Object.entries(purposeMap)) {
      if (operation.toLowerCase().includes(key)) {
        return purpose;
      }
    }

    return 'General user service operation';
  }

  /**
   * Clears old activity cache entries to prevent memory leaks
   */
  clearOldActivityCache(): void {
    const cutoffTime = new Date().getTime() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [userId, activities] of this.userActivityCache.entries()) {
      const filteredActivities = activities.filter(
        activity => activity.timestamp.getTime() > cutoffTime
      );
      
      if (filteredActivities.length === 0) {
        this.userActivityCache.delete(userId);
      } else {
        this.userActivityCache.set(userId, filteredActivities);
      }
    }
  }
}
