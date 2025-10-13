import { Injectable } from '@nestjs/common';
import { AlertEvent } from './alert-rules.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'log' | 'webhook' | 'email' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter?: ('low' | 'medium' | 'high' | 'critical')[];
}

@Injectable()
export class AlertManagerService {
  private readonly channels: Map<string, AlertChannel> = new Map();
  private readonly alertHistory: AlertEvent[] = [];
  private readonly maxHistorySize = 1000;

  constructor(private readonly logger: StructuredLoggerService) {
    this.initializeDefaultChannels();
  }

  private initializeDefaultChannels(): void {
    // Log channel for all alerts
    this.addChannel({
      id: 'log-all',
      name: 'Log All Alerts',
      type: 'log',
      config: {},
      enabled: true,
    });

    // Critical alerts to webhook (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.addChannel({
        id: 'webhook-critical',
        name: 'Webhook for Critical Alerts',
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_TOKEN ? `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}` : undefined,
          },
        },
        enabled: true,
        severityFilter: ['critical', 'high'],
      });
    }

    // Slack integration (if configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addChannel({
        id: 'slack-alerts',
        name: 'Slack Notifications',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: 'Auth Service Monitor',
          iconEmoji: ':warning:',
        },
        enabled: true,
        severityFilter: ['high', 'critical'],
      });
    }
  }

  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
  }

  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  updateChannel(channelId: string, updates: Partial<AlertChannel>): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      this.channels.set(channelId, { ...channel, ...updates });
    }
  }

  enableChannel(channelId: string): void {
    this.updateChannel(channelId, { enabled: true });
  }

  disableChannel(channelId: string): void {
    this.updateChannel(channelId, { enabled: false });
  }

  getAllChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  async sendAlert(alert: AlertEvent): Promise<void> {
    // Add to history
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.pop();
    }

    // Send to all enabled channels
    const promises = Array.from(this.channels.values())
      .filter(channel => this.shouldSendToChannel(channel, alert))
      .map(channel => this.sendToChannel(channel, alert));

    await Promise.allSettled(promises);
  }

  private shouldSendToChannel(channel: AlertChannel, alert: AlertEvent): boolean {
    if (!channel.enabled) {
      return false;
    }

    if (channel.severityFilter && !channel.severityFilter.includes(alert.severity)) {
      return false;
    }

    return true;
  }

  private async sendToChannel(channel: AlertChannel, alert: AlertEvent): Promise<void> {
    try {
      switch (channel.type) {
        case 'log':
          await this.sendToLog(alert);
          break;
        case 'webhook':
          await this.sendToWebhook(channel, alert);
          break;
        case 'slack':
          await this.sendToSlack(channel, alert);
          break;
        case 'email':
          await this.sendToEmail(channel, alert);
          break;
        default:
          this.logger.warn(`Unknown alert channel type: ${channel.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send alert to channel ${channel.id}`, error, {
        operation: 'send-alert',
        channelId: channel.id,
        channelType: channel.type,
        alertRuleId: alert.ruleId,
      });
    }
  }

  private async sendToLog(alert: AlertEvent): Promise<void> {
    this.logger.logSecurity(`Alert triggered: ${alert.ruleName}`, {
      securityEvent: 'alert-triggered',
      severity: alert.severity as any,
      metadata: {
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        message: alert.message,
        timestamp: alert.timestamp,
        alertMetadata: alert.metadata,
      },
    });
  }

  private async sendToWebhook(channel: AlertChannel, alert: AlertEvent): Promise<void> {
    const { default: axios } = await import('axios');
    
    const payload = {
      alert: {
        id: `${alert.ruleId}-${alert.timestamp.getTime()}`,
        rule: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        service: 'auth-service',
        metadata: alert.metadata,
      },
    };

    await axios({
      method: channel.config.method || 'POST',
      url: channel.config.url,
      headers: channel.config.headers || {},
      data: payload,
      timeout: 10000,
    });
  }

  private async sendToSlack(channel: AlertChannel, alert: AlertEvent): Promise<void> {
    const { default: axios } = await import('axios');
    
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.iconEmoji,
      attachments: [
        {
          color,
          title: `${emoji} ${alert.ruleName}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Service',
              value: 'Auth Service',
              short: true,
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true,
            },
          ],
          footer: 'Auth Service Monitor',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    await axios.post(channel.config.webhookUrl, payload, {
      timeout: 10000,
    });
  }

  private async sendToEmail(channel: AlertChannel, alert: AlertEvent): Promise<void> {
    // Email implementation would go here
    // For now, just log that we would send an email
    this.logger.log(`Would send email alert: ${alert.ruleName}`, {
      operation: 'send-email-alert',
      channelId: channel.id,
      alertRuleId: alert.ruleId,
    });
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#ff9500';
      case 'low': return 'good';
      default: return '#cccccc';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📢';
    }
  }

  getAlertHistory(limit = 100): AlertEvent[] {
    return this.alertHistory.slice(0, limit);
  }

  getAlertStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byRule: Record<string, number>;
    last24Hours: number;
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const bySeverity: Record<string, number> = {};
    const byRule: Record<string, number> = {};
    let last24HoursCount = 0;

    for (const alert of this.alertHistory) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byRule[alert.ruleName] = (byRule[alert.ruleName] || 0) + 1;
      
      if (alert.timestamp >= last24Hours) {
        last24HoursCount++;
      }
    }

    return {
      total: this.alertHistory.length,
      bySeverity,
      byRule,
      last24Hours: last24HoursCount,
    };
  }

  clearHistory(): void {
    this.alertHistory.length = 0;
  }
}