import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiExcludeEndpoint() // Exclude from Swagger as it's for Prometheus
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get metrics summary for monitoring dashboard' })
  @ApiResponse({ 
    status: 200, 
    description: 'Metrics summary',
    schema: {
      type: 'object',
      properties: {
        ratings: {
          type: 'object',
          properties: {
            totalCalculations: { type: 'number', example: 1500 },
            totalCacheOperations: { type: 'number', example: 3200 },
            activeCalculations: { type: 'number', example: 2 },
            cachedRatingsCount: { type: 'number', example: 850 },
            averageCalculationTime: { type: 'number', example: 0.025 }
          }
        },
        webhooks: {
          type: 'object',
          properties: {
            webhooksReceived: { 
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'achievement': 45, 'notification': 120, 'library': 78 }
            },
            webhooksProcessed: { 
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'achievement': 43, 'notification': 118, 'library': 76 }
            },
            webhookErrors: { 
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'achievement': 2, 'notification': 2, 'library': 2 }
            }
          }
        }
      }
    }
  })
  async getMetricsSummary() {
    const [ratingMetrics, webhookMetrics] = await Promise.all([
      this.metricsService.getRatingMetricsSummary(),
      this.metricsService.getWebhookMetricsSummary(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      service: 'review-service',
      ratings: ratingMetrics,
      webhooks: webhookMetrics,
    };
  }
}