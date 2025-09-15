import { Injectable, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @Optional() @InjectMetric('security_checks_total') private checks?: Counter<string>,
    @Optional() @InjectMetric('security_check_duration_seconds') private checkDuration?: Histogram<string>,
    @Optional() @InjectMetric('security_alerts_total') private alerts?: Counter<string>,
    @Optional() @InjectMetric('ip_blocks_total') private ipBlocks?: Counter<string>,
    @Optional() @InjectMetric('high_risk_events_total') private highRisk?: Counter<string>,
    @Optional() @InjectMetric('security_active_alerts') private activeAlerts?: Gauge<string>,
  ) {}

  recordCheck(type: string, allowed: boolean, durationSeconds?: number) {
    this.checks?.inc({ type, allowed: String(allowed) });
    if (durationSeconds !== undefined) this.checkDuration?.observe({ type }, durationSeconds);
  }

  recordAlert(type: string, severity: string) {
    this.alerts?.inc({ type, severity });
  }

  recordIpBlock(reason: string) {
    this.ipBlocks?.inc({ reason });
  }

  recordHighRiskEvent(type: string) {
    this.highRisk?.inc({ type });
  }

  setActiveAlerts(count: number) {
    this.activeAlerts?.set(count);
  }
}

