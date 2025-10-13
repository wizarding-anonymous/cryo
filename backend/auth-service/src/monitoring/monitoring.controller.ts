import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AlertingService } from './alerting/alerting.service';
import { AlertRulesService } from './alerting/alert-rules.service';
import { AlertManagerService } from './alerting/alert-manager.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly alertingService: AlertingService,
    private readonly alertRules: AlertRulesService,
    private readonly alertManager: AlertManagerService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get monitoring system status',
    description: 'Returns the current status of the monitoring and alerting system',
  })
  @ApiResponse({
    status: 200,
    description: 'Monitoring system status',
    schema: {
      type: 'object',
      properties: {
        isEvaluating: { type: 'boolean' },
        lastEvaluation: { type: 'string', format: 'date-time' },
        rulesCount: { type: 'number' },
        channelsCount: { type: 'number' },
        alertHistory: { type: 'array' },
      },
    },
  })
  getStatus() {
    return this.alertingService.getStatus();
  }

  @Get('alerts/rules')
  @ApiOperation({
    summary: 'Get all alert rules',
    description: 'Returns all configured alert rules',
  })
  @ApiResponse({
    status: 200,
    description: 'List of alert rules',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          enabled: { type: 'boolean' },
          cooldownMinutes: { type: 'number' },
        },
      },
    },
  })
  getAlertRules() {
    return this.alertRules.getAllRules();
  }

  @Post('alerts/rules/:ruleId/enable')
  @ApiOperation({
    summary: 'Enable alert rule',
    description: 'Enables a specific alert rule',
  })
  @ApiParam({ name: 'ruleId', description: 'Alert rule ID' })
  @ApiResponse({ status: 200, description: 'Alert rule enabled' })
  enableAlertRule(@Param('ruleId') ruleId: string) {
    this.alertRules.enableRule(ruleId);
    return { message: `Alert rule ${ruleId} enabled` };
  }

  @Post('alerts/rules/:ruleId/disable')
  @ApiOperation({
    summary: 'Disable alert rule',
    description: 'Disables a specific alert rule',
  })
  @ApiParam({ name: 'ruleId', description: 'Alert rule ID' })
  @ApiResponse({ status: 200, description: 'Alert rule disabled' })
  disableAlertRule(@Param('ruleId') ruleId: string) {
    this.alertRules.disableRule(ruleId);
    return { message: `Alert rule ${ruleId} disabled` };
  }

  @Get('alerts/history')
  @ApiOperation({
    summary: 'Get alert history',
    description: 'Returns recent alert history',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of alerts to return' })
  @ApiResponse({
    status: 200,
    description: 'Alert history',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          ruleName: { type: 'string' },
          severity: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
      },
    },
  })
  getAlertHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.alertManager.getAlertHistory(limitNum);
  }

  @Get('alerts/stats')
  @ApiOperation({
    summary: 'Get alert statistics',
    description: 'Returns alert statistics and metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        bySeverity: { type: 'object' },
        byRule: { type: 'object' },
        last24Hours: { type: 'number' },
      },
    },
  })
  getAlertStats() {
    return this.alertManager.getAlertStats();
  }

  @Post('alerts/test')
  @ApiOperation({
    summary: 'Test alert system',
    description: 'Sends a test alert to verify the alerting system is working',
  })
  @ApiResponse({ status: 200, description: 'Test alert sent' })
  async testAlert(@Body() body: { severity?: 'low' | 'medium' | 'high' | 'critical' }) {
    await this.alertingService.testAlert(body.severity);
    return { message: 'Test alert sent successfully' };
  }

  @Post('alerts/evaluate')
  @ApiOperation({
    summary: 'Trigger alert evaluation',
    description: 'Manually triggers alert rule evaluation',
  })
  @ApiResponse({ status: 200, description: 'Alert evaluation triggered' })
  async triggerEvaluation() {
    await this.alertingService.triggerEvaluation();
    return { message: 'Alert evaluation triggered' };
  }

  @Get('alerts/channels')
  @ApiOperation({
    summary: 'Get alert channels',
    description: 'Returns all configured alert channels',
  })
  @ApiResponse({
    status: 200,
    description: 'List of alert channels',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          enabled: { type: 'boolean' },
          severityFilter: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  getAlertChannels() {
    return this.alertManager.getAllChannels();
  }

  @Post('alerts/channels/:channelId/enable')
  @ApiOperation({
    summary: 'Enable alert channel',
    description: 'Enables a specific alert channel',
  })
  @ApiParam({ name: 'channelId', description: 'Alert channel ID' })
  @ApiResponse({ status: 200, description: 'Alert channel enabled' })
  enableAlertChannel(@Param('channelId') channelId: string) {
    this.alertManager.enableChannel(channelId);
    return { message: `Alert channel ${channelId} enabled` };
  }

  @Post('alerts/channels/:channelId/disable')
  @ApiOperation({
    summary: 'Disable alert channel',
    description: 'Disables a specific alert channel',
  })
  @ApiParam({ name: 'channelId', description: 'Alert channel ID' })
  @ApiResponse({ status: 200, description: 'Alert channel disabled' })
  disableAlertChannel(@Param('channelId') channelId: string) {
    this.alertManager.disableChannel(channelId);
    return { message: `Alert channel ${channelId} disabled` };
  }
}