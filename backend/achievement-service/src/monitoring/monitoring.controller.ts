import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  ServiceMonitorService,
  ServiceHealthStatus,
  CircuitBreakerState,
} from './service-monitor.service';

@Controller('monitoring')
@ApiTags('monitoring')
export class MonitoringController {
  constructor(private readonly serviceMonitorService: ServiceMonitorService) {}

  @Get('health/services')
  @ApiOperation({ summary: 'Get health status of all integrated services' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  getServicesHealth(): ServiceHealthStatus[] {
    return this.serviceMonitorService.getAllServiceHealthStatus();
  }

  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get circuit breaker states for all services' })
  @ApiResponse({ status: 200, description: 'Circuit breaker states' })
  getCircuitBreakerStates(): CircuitBreakerState[] {
    return this.serviceMonitorService.getAllCircuitBreakerStates();
  }

  @Get('health/overall')
  @ApiOperation({ summary: 'Get overall system health' })
  @ApiResponse({ status: 200, description: 'Overall system health' })
  getOverallHealth() {
    const services = this.serviceMonitorService.getAllServiceHealthStatus();
    const circuitBreakers = this.serviceMonitorService.getAllCircuitBreakerStates();

    const healthyServices = services.filter(s => s.isHealthy).length;
    const totalServices = services.length;
    const openCircuitBreakers = circuitBreakers.filter(cb => cb.state === 'OPEN').length;

    return {
      status:
        healthyServices === totalServices && openCircuitBreakers === 0 ? 'healthy' : 'degraded',
      services: {
        total: totalServices,
        healthy: healthyServices,
        unhealthy: totalServices - healthyServices,
      },
      circuitBreakers: {
        total: circuitBreakers.length,
        open: openCircuitBreakers,
        closed: circuitBreakers.filter(cb => cb.state === 'CLOSED').length,
        halfOpen: circuitBreakers.filter(cb => cb.state === 'HALF_OPEN').length,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
