import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { CreateSecurityAlertDto } from '../../dto/requests/create-security-alert.dto';
import { PaginatedSecurityAlerts } from '../../dto/responses/paginated-security-alerts.dto';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggerService } from '@nestjs/common';
import { SuspiciousActivityResult } from './types/suspicious-activity-result';
import { BehaviorAnalysis } from './types/behavior-analysis';
import { MetricsService } from '../../common/metrics/metrics.service';
import { ClientKafka } from '@nestjs/microservices';
import { KAFKA_PRODUCER_SERVICE } from '../../kafka/kafka.constants';
import { SecurityAlertSeverity } from '../../common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../../common/enums/security-alert-type.enum';
import { SecurityEventType } from '../../common/enums/security-event-type.enum';
import { EncryptionService } from '../../common/encryption/encryption.service';

@Injectable()
export class MonitoringService implements OnModuleDestroy {
  constructor(
    @InjectRepository(SecurityAlert)
    private readonly alertsRepo: Repository<SecurityAlert>,
    @InjectRepository(SecurityEvent)
    private readonly eventsRepo: Repository<SecurityEvent>,
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @Inject(KAFKA_PRODUCER_SERVICE)
    private readonly kafkaClient: ClientKafka,
    private readonly encryption: EncryptionService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async createAlert(dto: CreateSecurityAlertDto): Promise<SecurityAlert> {
    const encryptedData = this.encryption.encrypt(dto.data);

    const alert = this.alertsRepo.create({
      type: dto.type,
      severity: dto.severity,
      userId: dto.userId ?? null,
      ip: dto.ip ?? null,
      data: encryptedData as any,
      resolved: false,
    });
    const saved = await this.alertsRepo.save(alert);
    this.logger.warn('Security alert created', {
      id: saved.id,
      type: saved.type,
      severity: saved.severity,
    });
    this.metrics?.recordAlert(String(dto.type), String(dto.severity));

    if (
      saved.severity === SecurityAlertSeverity.HIGH ||
      saved.severity === SecurityAlertSeverity.CRITICAL
    ) {
      this.kafkaClient.emit('security.alerts.created', {
        ...saved,
        data: this.encryption.decrypt(saved.data as any), // Decrypt for the event
        timestamp: new Date().toISOString(),
      });
    }

    return saved;
  }

  async getAlerts(query: GetAlertsQueryDto): Promise<PaginatedSecurityAlerts> {
    const qb = this.alertsRepo.createQueryBuilder('a');
    if (query.type) qb.andWhere('a.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('a.severity = :severity', { severity: query.severity });
    if (typeof query.resolved === 'boolean')
      qb.andWhere('a.resolved = :resolved', { resolved: query.resolved });
    qb.orderBy('a.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.pageSize ?? 50;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const decryptedItems = items.map((item) => ({
      ...item,
      data: this.encryption.decrypt(item.data as any),
    }));

    return { data: decryptedItems, page, limit, total };
  }

  async getActiveAlerts(): Promise<SecurityAlert[]> {
    const items = await this.alertsRepo.find({
      where: { resolved: false },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    this.metrics?.setActiveAlerts(items.length);
    // Decrypt data before returning
    return items.map((item) => ({
      ...item,
      data: this.encryption.decrypt(item.data as any),
    }));
  }

  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId } });
    if (!alert) return;
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy ?? null;
    await this.alertsRepo.save(alert);
    this.logger.log('Security alert resolved', { id: alert.id });
  }

  async detectSuspiciousActivity(userId: string): Promise<SuspiciousActivityResult> {
    const minutes = this.config.get<number>('SECURITY_SUSPICIOUS_EVENTS_WINDOW_MIN', 10);
    const thresholdCount = this.config.get<number>('SECURITY_SUSPICIOUS_EVENTS_THRESHOLD', 20);
    const riskThreshold = this.config.get<number>('SECURITY_ALERT_RISK_THRESHOLD', 80);
    const since = new Date(Date.now() - minutes * 60_000);

    const events = await this.eventsRepo
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.created_at >= :since', { since: since.toISOString() })
      .orderBy('e.created_at', 'DESC')
      .getMany();

    const count = events.length;
    const highRisk = events.filter((e) => (e.riskScore ?? 0) >= riskThreshold).length;
    const suspicious = count >= thresholdCount || highRisk > 0;
    const reasons: string[] = [];
    if (count >= thresholdCount) reasons.push(`high activity: ${count} events in ${minutes}m`);
    if (highRisk > 0) reasons.push(`${highRisk} high-risk events (>=${riskThreshold})`);

    const score = Math.min(
      99,
      Math.max(0, Math.floor((count / thresholdCount) * 60 + highRisk * 20)),
    );
    return { suspicious, score, reasons };
  }

  async analyzeUserBehavior(userId: string): Promise<BehaviorAnalysis> {
    const days = this.config.get<number>('SECURITY_BEHAVIOR_WINDOW_DAYS', 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const events = await this.eventsRepo
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.created_at >= :since', { since: since.toISOString() })
      .orderBy('e.created_at', 'DESC')
      .getMany();

    const countsByType: Record<string, number> = {};
    let lastActiveAt: string | undefined;
    for (const e of events) {
      countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
      if (!lastActiveAt) lastActiveAt = e.createdAt.toISOString();
    }

    return { userId, countsByType, lastActiveAt };
  }

  /**
   * Automatic detection rule for multiple failed login attempts
   * Creates an alert if too many failed logins detected within time window
   */
  async checkMultipleFailedLogins(userId?: string, ip?: string): Promise<void> {
    const windowMinutes = this.config.get<number>('SECURITY_FAILED_LOGIN_WINDOW_MIN', 15);
    const threshold = this.config.get<number>('SECURITY_FAILED_LOGIN_THRESHOLD', 5);
    const since = new Date(Date.now() - windowMinutes * 60_000);

    const qb = this.eventsRepo
      .createQueryBuilder('e')
      .where('e.type = :type', { type: SecurityEventType.FAILED_LOGIN })
      .andWhere('e.created_at >= :since', { since: since.toISOString() });

    if (userId) {
      qb.andWhere('e.user_id = :userId', { userId });
    }
    if (ip) {
      qb.andWhere('e.ip = :ip', { ip });
    }

    const failedLogins = await qb.getCount();

    if (failedLogins >= threshold) {
      const severity = failedLogins >= threshold * 2 
        ? SecurityAlertSeverity.HIGH 
        : SecurityAlertSeverity.MEDIUM;

      await this.createAlert({
        type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        severity,
        userId,
        ip,
        data: {
          failedLoginCount: failedLogins,
          windowMinutes,
          threshold,
          detectedAt: new Date().toISOString(),
        },
      });

      this.logger.warn('Multiple failed logins detected', {
        userId,
        ip,
        count: failedLogins,
        windowMinutes,
      });
    }
  }

  /**
   * Automatic detection rule for unusual purchase patterns
   * Creates an alert if purchase behavior is suspicious
   */
  async checkUnusualPurchase(userId: string, purchaseAmount: number, ip: string): Promise<void> {
    const days = this.config.get<number>('SECURITY_PURCHASE_ANALYSIS_DAYS', 30);
    const unusualAmountMultiplier = this.config.get<number>('SECURITY_UNUSUAL_PURCHASE_MULTIPLIER', 5);
    const highAmountThreshold = this.config.get<number>('SECURITY_HIGH_PURCHASE_THRESHOLD', 10000);
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);

    // Get user's purchase history
    const purchaseEvents = await this.eventsRepo
      .createQueryBuilder('e')
      .where('e.type = :type', { type: SecurityEventType.PURCHASE })
      .andWhere('e.user_id = :userId', { userId })
      .andWhere('e.created_at >= :since', { since: since.toISOString() })
      .getMany();

    let isUnusual = false;
    let severity = SecurityAlertSeverity.LOW;
    const reasons: string[] = [];

    // Check if amount is unusually high compared to history
    if (purchaseEvents.length > 0) {
      const amounts = purchaseEvents
        .map(e => (e.data as any)?.amount)
        .filter(amount => typeof amount === 'number');
      
      if (amounts.length > 0) {
        const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const maxAmount = Math.max(...amounts);
        
        if (purchaseAmount > avgAmount * unusualAmountMultiplier) {
          isUnusual = true;
          severity = SecurityAlertSeverity.MEDIUM;
          reasons.push(`Amount ${purchaseAmount} is ${Math.round(purchaseAmount / avgAmount)}x higher than average (${Math.round(avgAmount)})`);
        }
        
        if (purchaseAmount > maxAmount * 2) {
          isUnusual = true;
          severity = SecurityAlertSeverity.HIGH;
          reasons.push(`Amount ${purchaseAmount} is 2x higher than previous maximum (${maxAmount})`);
        }
      }
    }

    // Check if amount is above high threshold
    if (purchaseAmount >= highAmountThreshold) {
      isUnusual = true;
      severity = SecurityAlertSeverity.HIGH;
      reasons.push(`High amount purchase: ${purchaseAmount} >= ${highAmountThreshold}`);
    }

    // Check for rapid successive purchases
    const recentPurchases = purchaseEvents.filter(
      e => new Date(e.createdAt).getTime() > Date.now() - 60 * 60_000 // Last hour
    );
    
    if (recentPurchases.length >= 3) {
      isUnusual = true;
      severity = SecurityAlertSeverity.MEDIUM;
      reasons.push(`${recentPurchases.length} purchases in the last hour`);
    }

    // Check for purchases from new IP
    const userIPs = new Set(purchaseEvents.map(e => e.ip));
    if (!userIPs.has(ip) && purchaseEvents.length > 0) {
      isUnusual = true;
      reasons.push(`Purchase from new IP address: ${ip}`);
    }

    if (isUnusual) {
      await this.createAlert({
        type: SecurityAlertType.UNUSUAL_PURCHASE,
        severity,
        userId,
        ip,
        data: {
          purchaseAmount,
          reasons,
          historicalPurchases: purchaseEvents.length,
          detectedAt: new Date().toISOString(),
        },
      });

      this.logger.warn('Unusual purchase detected', {
        userId,
        ip,
        amount: purchaseAmount,
        reasons,
      });
    }
  }

  /**
   * Run all automatic detection rules for a security event
   * This method should be called whenever a new security event is logged
   */
  async runAutomaticDetection(event: SecurityEvent): Promise<void> {
    try {
      // Check for multiple failed logins
      if (event.type === SecurityEventType.FAILED_LOGIN) {
        await this.checkMultipleFailedLogins(event.userId || undefined, event.ip);
      }

      // Check for unusual purchases
      if (event.type === SecurityEventType.PURCHASE) {
        const purchaseAmount = (event.data as any)?.amount;
        if (typeof purchaseAmount === 'number' && event.userId) {
          await this.checkUnusualPurchase(event.userId, purchaseAmount, event.ip);
        }
      }

      // Check for general suspicious activity patterns
      if (event.userId) {
        const suspiciousResult = await this.detectSuspiciousActivity(event.userId);
        if (suspiciousResult.suspicious && suspiciousResult.score >= 80) {
          await this.createAlert({
            type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
            severity: suspiciousResult.score >= 90 
              ? SecurityAlertSeverity.CRITICAL 
              : SecurityAlertSeverity.HIGH,
            userId: event.userId,
            ip: event.ip,
            data: {
              suspiciousScore: suspiciousResult.score,
              reasons: suspiciousResult.reasons,
              triggerEvent: {
                id: event.id,
                type: event.type,
              },
              detectedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error running automatic detection rules', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
