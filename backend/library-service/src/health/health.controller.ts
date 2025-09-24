import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis.health';
import { CacheHealthIndicator } from './cache.health';
import { ExternalServicesHealthIndicator } from './external-services.health';
import { ProductionHealthService } from './production-health.service';
import { MetricsService } from './metrics.service';
import { DatabaseHealthService } from '../database/database-health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private cache: CacheHealthIndicator,
    private externalServices: ExternalServicesHealthIndicator,
    private productionHealth: ProductionHealthService,
    private metricsService: MetricsService,
    private databaseHealth: DatabaseHealthService,
  ) { }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Basic health check',
    description: 'Performs basic health checks for database and Redis (if not in test environment)',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
          },
        },
        error: { type: 'object' },
        details: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Health check failed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'down' },
                message: { type: 'string', example: 'Connection timeout' },
              },
            },
          },
        },
      },
    },
  })
  async check() {
    const isTest = (process.env.NODE_ENV || '').toLowerCase() === 'test';
    const checks = [
      async () => {
        try {
          const result = await this.db.pingCheck('database', { timeout: 300 });
          this.metricsService.recordHealthCheck('database', 'success');
          return result;
        } catch (error) {
          this.metricsService.recordHealthCheck('database', 'failure');
          throw error;
        }
      }
    ];

    if (!isTest) {
      checks.push(async () => {
        try {
          const result = await this.redis.isHealthy('redis');
          this.metricsService.recordHealthCheck('redis', 'success');
          return result;
        } catch (error) {
          this.metricsService.recordHealthCheck('redis', 'failure');
          throw error;
        }
      });
    }

    return this.health.check(checks);
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({
    summary: 'Detailed health check',
    description: 'Performs comprehensive health checks including database, Redis, cache, and external services',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed health check passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            cache: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            'game-catalog-service': {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            'payment-service': {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
            'user-service': {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
              },
            },
          },
        },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Detailed health check failed',
  })
  async checkDetailed() {
    const isTest = (process.env.NODE_ENV || '').toLowerCase() === 'test';
    const checks = [
      async () => {
        try {
          const result = await this.databaseHealth.isHealthy('database');
          this.metricsService.recordHealthCheck('database', 'success');
          return result;
        } catch (error) {
          this.metricsService.recordHealthCheck('database', 'failure');
          throw error;
        }
      },
      async () => {
        try {
          const result = await this.redis.isHealthy('redis');
          this.metricsService.recordHealthCheck('redis', 'success');
          return result;
        } catch (error) {
          this.metricsService.recordHealthCheck('redis', 'failure');
          throw error;
        }
      },
      async () => {
        try {
          const result = await this.cache.isHealthy('cache');
          this.metricsService.recordHealthCheck('cache', 'success');
          return result;
        } catch (error) {
          this.metricsService.recordHealthCheck('cache', 'failure');
          throw error;
        }
      },
    ];

    // Add external service checks in non-test environment
    if (!isTest) {
      checks.push(
        async () => {
          try {
            const result = await this.externalServices.checkGameCatalogService('game-catalog-service');
            this.metricsService.recordHealthCheck('game-catalog-service', 'success');
            this.metricsService.setExternalServiceStatus('game-catalog', 1);
            return result;
          } catch (error) {
            this.metricsService.recordHealthCheck('game-catalog-service', 'failure');
            this.metricsService.setExternalServiceStatus('game-catalog', 0);
            throw error;
          }
        },
        async () => {
          try {
            const result = await this.externalServices.checkPaymentService('payment-service');
            this.metricsService.recordHealthCheck('payment-service', 'success');
            this.metricsService.setExternalServiceStatus('payment', 1);
            return result;
          } catch (error) {
            this.metricsService.recordHealthCheck('payment-service', 'failure');
            this.metricsService.setExternalServiceStatus('payment', 0);
            throw error;
          }
        },
        async () => {
          try {
            const result = await this.externalServices.checkUserService('user-service');
            this.metricsService.recordHealthCheck('user-service', 'success');
            this.metricsService.setExternalServiceStatus('user', 1);
            return result;
          } catch (error) {
            this.metricsService.recordHealthCheck('user-service', 'failure');
            this.metricsService.setExternalServiceStatus('user', 0);
            throw error;
          }
        }
      );
    }

    return this.health.check(checks);
  }

  @Get('external')
  @HealthCheck()
  @ApiOperation({
    summary: 'External services health check',
    description: 'Checks the health of all external services (Game Catalog, Payment, User services)',
  })
  @ApiResponse({
    status: 200,
    description: 'External services health check passed',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more external services are down',
  })
  async checkExternalServices() {
    const isTest = (process.env.NODE_ENV || '').toLowerCase() === 'test';

    if (isTest) {
      return this.health.check([]);
    }

    const checks = [
      () => this.externalServices.checkAllExternalServices('external-services')
    ];

    return this.health.check(checks);
  }

  @Get('production')
  @HealthCheck()
  @ApiOperation({
    summary: 'Production readiness health check',
    description: 'Comprehensive production readiness check including system, performance, security, resources, and external services',
  })
  @ApiResponse({
    status: 200,
    description: 'Production health check passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            environment: { type: 'string', example: 'production' },
            timestamp: { type: 'string', format: 'date-time' },
            isProduction: { type: 'boolean', example: true },
            system: { type: 'object' },
            performance: { type: 'object' },
            security: { type: 'object' },
            resources: { type: 'object' },
            external: { type: 'object' },
          },
        },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Production health check failed',
  })
  async checkProductionReadiness() {
    return this.productionHealth.checkProductionReadiness();
  }

  @Get('metrics-summary')
  @ApiOperation({
    summary: 'Get metrics summary',
    description: 'Returns a summary of service metrics and status information',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        service: { type: 'string', example: 'library-service' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
        uptime: { type: 'number', example: 3600.5 },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number', example: 52428800 },
            heapTotal: { type: 'number', example: 20971520 },
            heapUsed: { type: 'number', example: 18874368 },
            external: { type: 'number', example: 1089024 },
            arrayBuffers: { type: 'number', example: 17632 },
          },
        },
        endpoints: {
          type: 'object',
          properties: {
            health: { type: 'string', example: '/health' },
            detailed: { type: 'string', example: '/health/detailed' },
            external: { type: 'string', example: '/health/external' },
            production: { type: 'string', example: '/health/production' },
            metrics: { type: 'string', example: '/metrics' },
          },
        },
      },
    },
  })
  async getMetricsSummary() {
    return {
      timestamp: new Date().toISOString(),
      service: 'library-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      endpoints: {
        health: '/health',
        detailed: '/health/detailed',
        external: '/health/external',
        production: '/health/production',
        metrics: '/metrics',
      },
    };
  }
}
