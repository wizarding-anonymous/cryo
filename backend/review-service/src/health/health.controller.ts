import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async getHealth() {
    return this.healthService.getBasicHealth();
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with service integrations' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async getReadiness() {
    return this.healthService.getReadiness();
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness() {
    return this.healthService.getLiveness();
  }
}