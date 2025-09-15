import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { CreateSecurityAlertDto } from '../../dto/requests/create-security-alert.dto';
import { PaginatedSecurityAlerts } from '../../dto/responses/paginated-security-alerts.dto';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { SuspiciousActivityResult } from './types/suspicious-activity-result';
import { BehaviorAnalysis } from './types/behavior-analysis';
import { MetricsService } from '../../common/metrics/metrics.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(SecurityAlert)
    private readonly alertsRepo: Repository<SecurityAlert>,
    @InjectRepository(SecurityEvent)
    private readonly eventsRepo: Repository<SecurityEvent>,
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async createAlert(dto: CreateSecurityAlertDto): Promise<SecurityAlert> {
    const alert = this.alertsRepo.create({
      type: dto.type,
      severity: dto.severity,
      userId: dto.userId ?? null,
      ip: dto.ip ?? null,
      data: dto.data ?? null,
      resolved: false,
    });
    const saved = await this.alertsRepo.save(alert);
    this.logger.warn('Security alert created', { id: saved.id, type: saved.type, severity: saved.severity });
    this.metrics?.recordAlert(String(dto.type), String(dto.severity));
    return saved;
  }

  async getAlerts(query: GetAlertsQueryDto): Promise<PaginatedSecurityAlerts> {
    const qb = this.alertsRepo.createQueryBuilder('a');
    if (query.type) qb.andWhere('a.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('a.severity = :severity', { severity: query.severity });
    if (typeof query.resolved === 'boolean') qb.andWhere('a.resolved = :resolved', { resolved: query.resolved });
    qb.orderBy('a.created_at', 'DESC');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, page, pageSize, total };
  }

  async getActiveAlerts(): Promise<SecurityAlert[]> {
    const items = await this.alertsRepo.find({ where: { resolved: false }, order: { createdAt: 'DESC' }, take: 200 });
    this.metrics?.setActiveAlerts(items.length);
    return items;
  }

  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId } });
    if (!alert) return;
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy ?? null;
    await this.alertsRepo.save(alert);
    this.logger.info('Security alert resolved', { id: alert.id });
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

    const score = Math.min(99, Math.max(0, Math.floor((count / thresholdCount) * 60 + highRisk * 20)));
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
}
