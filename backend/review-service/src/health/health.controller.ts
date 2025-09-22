import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from '../app.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service health status with detailed checks',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok', enum: ['ok', 'degraded', 'error'] },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'review-service' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'production' },
        uptime: { type: 'string', example: '3600s' },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                reviews: { type: 'number', example: 1500 },
                ratings: { type: 'number', example: 850 },
                responseTime: { type: 'string', example: '<10ms' }
              }
            },
            cache: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                connected: { type: 'boolean', example: true },
                responseTime: { type: 'string', example: '<5ms' }
              }
            },
            externalServices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'library-service' },
                  status: { type: 'string', example: 'ok' },
                  responseTime: { type: 'string', example: '45ms' }
                }
              }
            },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'string', example: '128MB' },
                total: { type: 'string', example: '256MB' },
                percentage: { type: 'string', example: '50%' }
              }
            }
          }
        }
      }
    }
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint for Kubernetes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is ready to accept traffic',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready', enum: ['ready', 'not_ready'] },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'review-service' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'ok' },
            cache: { type: 'string', example: 'ok' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  getReadiness() {
    return this.appService.getReadiness();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe endpoint for Kubernetes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is alive and functioning',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'alive', enum: ['alive', 'unhealthy'] },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'review-service' },
        uptime: { type: 'string', example: '3600s' },
        memory: {
          type: 'object',
          properties: {
            used: { type: 'string', example: '128MB' },
            total: { type: 'string', example: '256MB' },
            percentage: { type: 'string', example: '50%' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  getLiveness() {
    return this.appService.getLiveness();
  }
}