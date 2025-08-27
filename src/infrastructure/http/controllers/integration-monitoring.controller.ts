import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IntegrationMonitoringService } from '../../../application/services/integration-monitoring.service';
import { 
  IntegrationHealth, 
  EventDeliveryMetrics, 
  IntegrationDashboardData 
} from '../../../application/interfaces/integration-monitoring.interface';

@ApiTags('Integration Monitoring')
@Controller('api/v1/monitoring/integrations')
export class IntegrationMonitoringController {
  constructor(
    private readonly integrationMonitoringService: IntegrationMonitoringService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get integration health status' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service name' })
  @ApiResponse({ 
    status: 200, 
    description: 'Integration health status',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          serviceName: { type: 'string' },
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          lastCheck: { type: 'string', format: 'date-time' },
          responseTime: { type: 'number' },
          errorRate: { type: 'number' },
          details: { type: 'object' },
        },
      },
    },
  })
  async getIntegrationHealth(@Query('service') serviceName?: string): Promise<IntegrationHealth[]> {
    return this.integrationMonitoringService.getIntegrationHealth(serviceName);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get event delivery metrics' })
  @ApiQuery({ name: 'topic', required: false, description: 'Filter by event topic' })
  @ApiResponse({ 
    status: 200, 
    description: 'Event delivery metrics',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          successCount: { type: 'number' },
          failureCount: { type: 'number' },
          lastDelivery: { type: 'string', format: 'date-time' },
          averageDeliveryTime: { type: 'number' },
        },
      },
    },
  })
  async getEventMetrics(@Query('topic') topic?: string): Promise<EventDeliveryMetrics[]> {
    return this.integrationMonitoringService.getEventDeliveryMetrics(topic);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get integration monitoring dashboard data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Complete dashboard data including health checks, metrics, and summary',
    schema: {
      type: 'object',
      properties: {
        healthChecks: {
          type: 'array',
          items: { $ref: '#/components/schemas/IntegrationHealth' },
        },
        eventMetrics: {
          type: 'array',
          items: { $ref: '#/components/schemas/EventDeliveryMetrics' },
        },
        summary: {
          type: 'object',
          properties: {
            totalIntegrations: { type: 'number' },
            healthyIntegrations: { type: 'number' },
            totalEvents: { type: 'number' },
            failedEvents: { type: 'number' },
          },
        },
      },
    },
  })
  async getDashboardData(): Promise<IntegrationDashboardData> {
    return this.integrationMonitoringService.getIntegrationDashboardData();
  }
}