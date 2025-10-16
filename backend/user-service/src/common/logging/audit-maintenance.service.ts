import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';
import { SecurityClient } from '../../integrations/security/security.client';
import { LoggingService } from './logging.service';

@Injectable()
export class AuditMaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(AuditMaintenanceService.name);
  private readonly dailyStats = new Map<string, any>();

  constructor(
    private readonly auditService: AuditService,
    private readonly securityClient: SecurityClient,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit() {
    this.logger.log('Audit Maintenance Service initialized');
  }

  /**
   * Clears old activity cache entries every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async clearOldActivityCache(): Promise<void> {
    try {
      this.logger.debug('Starting activity cache cleanup...');
      this.auditService.clearOldActivityCache();
      this.logger.debug('Activity cache cleanup completed');
    } catch (error) {
      this.logger.error('Failed to clear activity cache', error.stack);
    }
  }

  /**
   * Generates and sends daily audit summary every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyAuditSummary(): Promise<void> {
    try {
      this.logger.log('Generating daily audit summary...');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const summary = this.generateAuditSummary(yesterday, today);
      
      // Log the summary
      this.loggingService.info('Daily Audit Summary Generated', {
        operation: 'daily_audit_summary',
        correlationId: `audit-summary-${yesterday.toISOString().split('T')[0]}`,
        metadata: summary,
      });

      // Send to Security Service
      await this.securityClient.sendAuditTrail({
        userId: 'system',
        operation: 'DAILY_AUDIT_SUMMARY',
        resource: 'audit_summary',
        resourceId: yesterday.toISOString().split('T')[0],
        timestamp: new Date(),
        ipAddress: 'internal',
        userAgent: 'audit-maintenance-service',
        correlationId: `audit-summary-${yesterday.toISOString().split('T')[0]}`,
        success: true,
        metadata: summary,
      });

      this.logger.log('Daily audit summary sent to Security Service');
    } catch (error) {
      this.logger.error('Failed to generate daily audit summary', error.stack);
    }
  }

  /**
   * Performs weekly compliance check every Sunday at 2 AM
   */
  @Cron('0 2 * * 0') // Every Sunday at 2 AM
  async performWeeklyComplianceCheck(): Promise<void> {
    try {
      this.logger.log('Starting weekly compliance check...');
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const complianceReport = await this.securityClient.requestComplianceReport(
        'GDPR_ACCESS_LOG',
        'system',
        undefined,
        {
          start: oneWeekAgo,
          end: new Date(),
        },
      );

      if (complianceReport) {
        this.loggingService.info('Weekly Compliance Check Completed', {
          operation: 'weekly_compliance_check',
          correlationId: `compliance-check-${new Date().toISOString().split('T')[0]}`,
          metadata: {
            reportType: complianceReport.reportType,
            totalEvents: complianceReport.summary.totalEvents,
            successfulEvents: complianceReport.summary.successfulEvents,
            failedEvents: complianceReport.summary.failedEvents,
            dataCategories: complianceReport.summary.dataCategories,
            timeRange: complianceReport.timeRange,
          },
        });

        // Check for compliance issues
        const complianceIssues = this.analyzeComplianceReport(complianceReport);
        
        if (complianceIssues.length > 0) {
          this.logger.warn(
            `Found ${complianceIssues.length} compliance issues in weekly check`,
          );
          
          for (const issue of complianceIssues) {
            await this.securityClient.reportSuspiciousActivity({
              userId: 'system',
              activityType: 'COMPLIANCE_VIOLATION',
              severity: issue.severity,
              riskScore: issue.riskScore,
              ipAddress: 'internal',
              userAgent: 'audit-maintenance-service',
              correlationId: `compliance-issue-${Date.now()}`,
              details: issue.details,
            });
          }
        }
      }

      this.logger.log('Weekly compliance check completed');
    } catch (error) {
      this.logger.error('Failed to perform weekly compliance check', error.stack);
    }
  }

  /**
   * Monitors Security Service health every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorSecurityServiceHealth(): Promise<void> {
    try {
      const healthStatus = await this.securityClient.healthCheck();
      
      if (healthStatus.status === 'unhealthy') {
        this.logger.error('Security Service is unhealthy');
        
        this.loggingService.logSecurityEvent(
          'Security Service connectivity issue',
          'system',
          `health-check-${Date.now()}`,
          'internal',
          'audit-maintenance-service',
          'high',
          {
            healthStatus: healthStatus.status,
            lastCheck: new Date(),
          },
        );
      } else {
        this.logger.debug(
          `Security Service is healthy (latency: ${healthStatus.latency}ms)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to check Security Service health', error.stack);
    }
  }

  /**
   * Generates audit summary for a given time period
   */
  private generateAuditSummary(startDate: Date, endDate: Date): any {
    // In a real implementation, this would query the audit logs
    // For now, we'll generate a mock summary
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      statistics: {
        totalEvents: Math.floor(Math.random() * 10000) + 1000,
        successfulEvents: Math.floor(Math.random() * 9000) + 900,
        failedEvents: Math.floor(Math.random() * 100) + 10,
        uniqueUsers: Math.floor(Math.random() * 500) + 50,
        suspiciousActivities: Math.floor(Math.random() * 10),
        complianceEvents: Math.floor(Math.random() * 50) + 5,
      },
      topOperations: [
        { operation: 'user_read', count: Math.floor(Math.random() * 1000) + 100 },
        { operation: 'profile_view', count: Math.floor(Math.random() * 800) + 80 },
        { operation: 'user_update', count: Math.floor(Math.random() * 200) + 20 },
        { operation: 'profile_update', count: Math.floor(Math.random() * 150) + 15 },
        { operation: 'user_create', count: Math.floor(Math.random() * 50) + 5 },
      ],
      riskMetrics: {
        averageRiskScore: Math.floor(Math.random() * 30) + 10,
        highRiskEvents: Math.floor(Math.random() * 5),
        criticalRiskEvents: Math.floor(Math.random() * 2),
      },
    };
  }

  /**
   * Analyzes compliance report for potential issues
   */
  private analyzeComplianceReport(report: any): Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    details: Record<string, any>;
  }> {
    const issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      riskScore: number;
      details: Record<string, any>;
    }> = [];

    // Check failure rate
    const failureRate = report.summary.failedEvents / report.summary.totalEvents;
    if (failureRate > 0.05) { // More than 5% failure rate
      issues.push({
        severity: failureRate > 0.1 ? 'high' : 'medium',
        riskScore: Math.floor(failureRate * 100),
        details: {
          issueType: 'HIGH_FAILURE_RATE',
          failureRate: failureRate,
          totalEvents: report.summary.totalEvents,
          failedEvents: report.summary.failedEvents,
        },
      });
    }

    // Check for missing data categories (GDPR requirement)
    const requiredDataCategories = ['personal_data', 'profile_data'];
    const missingCategories = requiredDataCategories.filter(
      category => !report.summary.dataCategories.includes(category)
    );

    if (missingCategories.length > 0) {
      issues.push({
        severity: 'medium',
        riskScore: 40,
        details: {
          issueType: 'MISSING_DATA_CATEGORIES',
          missingCategories,
          requiredCategories: requiredDataCategories,
        },
      });
    }

    return issues;
  }

  /**
   * Manual trigger for audit summary generation (for testing)
   */
  async generateManualAuditSummary(startDate: Date, endDate: Date): Promise<any> {
    this.logger.log('Generating manual audit summary...');
    
    const summary = this.generateAuditSummary(startDate, endDate);
    
    this.loggingService.info('Manual Audit Summary Generated', {
      operation: 'manual_audit_summary',
      correlationId: `manual-audit-summary-${Date.now()}`,
      metadata: summary,
    });

    return summary;
  }
}