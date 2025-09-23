import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import {
  ExternalServicesHealthService,
  ServiceHealth,
} from '../clients/external-services-health.service';
import { CircuitBreakerService } from '../clients/circuit-breaker.service';

interface HealthResponse {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface DetailedHealthResponse extends HealthResponse {
  services?: Record<string, ServiceHealth>;
  circuits?: Record<string, any>;
  database?: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  cache?: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
}

@ApiTags('Health')
@Controller('v1/health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly externalServicesHealthService: ExternalServicesHealthService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check for Kubernetes probes' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  check(@Res() res: Response): void {
    try {
      const memoryUsage = process.memoryUsage();
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
      };

      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check including external dependencies' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async checkDetailed(@Res() res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const externalHealth = this.externalServicesHealthService.getHealthStatus();
      const allHealthy = this.externalServicesHealthService.areAllServicesHealthy();
      const circuitStats = this.circuitBreakerService.getAllStats();

      const response: DetailedHealthResponse = {
        status: allHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
        services: externalHealth,
        circuits: circuitStats,
      };

      const statusCode = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      res.status(statusCode).json(response);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  @Get('external')
  @ApiOperation({ summary: 'Check the health status of external services' })
  @ApiResponse({ status: 200, description: 'External services health status' })
  checkExternal(): { status: string; timestamp: string; services: Record<string, ServiceHealth> } {
    const externalHealth = this.externalServicesHealthService.getHealthStatus();
    const allHealthy = this.externalServicesHealthService.areAllServicesHealthy();

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: externalHealth,
    };
  }

  @Get('circuits')
  @ApiOperation({ summary: 'Check the status of circuit breakers' })
  @ApiResponse({ status: 200, description: 'Circuit breaker status' })
  checkCircuits(): { timestamp: string; circuits: Record<string, any> } {
    const circuitStats = this.circuitBreakerService.getAllStats();

    return {
      timestamp: new Date().toISOString(),
      circuits: circuitStats,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness(@Res() res: Response): Promise<void> {
    try {
      // Check if all critical dependencies are available
      const allHealthy = this.externalServicesHealthService.areAllServicesHealthy();

      if (allHealthy) {
        res.status(HttpStatus.OK).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          reason: 'External dependencies not available',
        });
      }
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(@Res() res: Response): void {
    res.status(HttpStatus.OK).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    });
  }
}
