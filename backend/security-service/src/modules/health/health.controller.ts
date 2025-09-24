import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(
    @Inject('DATA_SOURCE') private dataSource: DataSource,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'security-service',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    try {
      // Check database connection
      const dbStatus = this.dataSource.isInitialized ? 'up' : 'down';
      
      // Check Redis connection
      let redisStatus = 'down';
      try {
        await this.redisClient.ping();
        redisStatus = 'up';
      } catch (error) {
        redisStatus = 'down';
      }

      const isReady = dbStatus === 'up' && redisStatus === 'up';

      return {
        status: isReady ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        service: 'security-service',
        check: 'ready',
        dependencies: {
          database: { status: dbStatus },
          redis: { status: redisStatus }
        },
        details: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'security-service',
        check: 'ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'security-service',
      check: 'live',
      uptime: process.uptime(),
    };
  }
}
