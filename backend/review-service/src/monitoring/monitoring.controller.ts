import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import type { MonitoringMetrics } from './monitoring.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('services')
  @ApiOperation({ summary: 'Get service integration status' })
  @ApiResponse({ status: 200, description: 'Service monitoring metrics' })
  getServiceMetrics(): MonitoringMetrics {
    return this.monitoringService.getMonitoringMetrics();
  }

  @Get('services/:serviceName')
  @ApiOperation({ summary: 'Get specific service status' })
  @ApiResponse({ status: 200, description: 'Individual service status' })
  getServiceStatus(@Param('serviceName') serviceName: string) {
    const status = this.monitoringService.getServiceStatus(serviceName);
    if (!status) {
      throw new NotFoundException(`Service ${serviceName} not found`);
    }
    return status;
  }

  @Post('check')
  @ApiOperation({ summary: 'Trigger manual health check' })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async triggerHealthCheck(): Promise<MonitoringMetrics> {
    return this.monitoringService.triggerHealthCheck();
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset error counts for all services' })
  @ApiResponse({ status: 200, description: 'Error counts reset' })
  resetErrorCounts() {
    this.monitoringService.resetErrorCounts();
    return { message: 'Error counts reset successfully' };
  }
}