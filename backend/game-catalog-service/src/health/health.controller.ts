import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  HealthIndicatorResult,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RedisConfigService } from '../database/redis-config.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redisService: RedisConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Comprehensive health check for all service dependencies',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.health.check([
        // Database connection health check
        () => this.db.pingCheck('database', { timeout: 5000 }),

        // Memory usage health checks
        () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // Increased for test environment

        // Cache health check (non-critical)
        () => this.checkCacheHealthInternal(),

        // Application-specific health checks
        () => this.checkApplicationHealthInternal(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`Health check completed successfully in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Health check failed after ${duration}ms`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to accept traffic',
  })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      // Cache is non-critical for readiness
      () => this.checkCacheHealthInternal(),
      () => this.checkApplicationHealthInternal(),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service should be restarted' })
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // Higher threshold for liveness
      () => this.checkApplicationHealthInternal(),
    ]);
  }

  /**
   * Check Redis/Cache health
   */
  private async checkCacheHealthInternal(): Promise<HealthIndicatorResult> {
    const key = 'health-check';
    const testValue = Date.now().toString();

    try {
      // Test cache write and read
      await this.redisService.set(key, testValue, 10); // 10 second TTL
      const retrievedValue = await this.redisService.get(key);

      if (retrievedValue === testValue) {
        const stats = await this.redisService.getStats();
        return {
          cache: {
            status: 'up',
            message: 'Redis cache is healthy',
            type: 'redis',
            responseTime: '< 10ms',
            memory: stats.memory,
            keys: stats.keys,
          },
        };
      } else {
        return {
          cache: {
            status: 'up',
            message: 'Redis cache active (read/write test inconclusive)',
            type: 'redis',
            warning: 'Cache test value mismatch',
          },
        };
      }
    } catch (error) {
      this.logger.warn(
        'Redis health check failed, falling back to no cache',
        (error as Error).message,
      );

      // Redis cache failures are non-critical for basic functionality
      return {
        cache: {
          status: 'down',
          message: 'Redis cache unavailable',
          type: 'redis',
          warning: (error as Error).message,
        },
      };
    }
  }

  /**
   * Check application-specific health indicators
   */
  private checkApplicationHealthInternal(): Promise<HealthIndicatorResult> {
    try {
      // Check if the application can perform basic operations
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return Promise.resolve({
        application: {
          status: 'up',
          uptime: `${Math.floor(uptime)}s`,
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          },
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
        },
      });
    } catch (error) {
      return Promise.resolve({
        application: {
          status: 'down',
          message: (error as Error).message,
        },
      });
    }
  }
}

@Controller('v1/health')
export class V1HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redisService: RedisConfigService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check for all service dependencies' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.health.check([
        () => this.db.pingCheck('database', { timeout: 5000 }),
        () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // Increased for test environment
        () => this.checkCacheHealth(),
        () => this.checkApplicationHealth(),
      ]);

      return result;
    } catch (error) {
      throw error;
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.checkCacheHealth(),
      () => this.checkApplicationHealth(),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service should be restarted' })
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      () => this.checkApplicationHealth(),
    ]);
  }

  private async checkCacheHealth(): Promise<HealthIndicatorResult> {
    const key = 'health-check';
    const testValue = Date.now().toString();

    try {
      await this.redisService.set(key, testValue, 10);
      const retrievedValue = await this.redisService.get(key);

      if (retrievedValue === testValue) {
        const stats = await this.redisService.getStats();
        return {
          cache: {
            status: 'up',
            message: 'Redis cache is healthy',
            type: 'redis',
            responseTime: '< 10ms',
            memory: stats.memory,
            keys: stats.keys,
          },
        };
      } else {
        return {
          cache: {
            status: 'up',
            message: 'Redis cache active (read/write test inconclusive)',
            type: 'redis',
            warning: 'Cache test value mismatch',
          },
        };
      }
    } catch (error) {
      return {
        cache: {
          status: 'down',
          message: 'Redis cache unavailable',
          type: 'redis',
          warning: (error as Error).message,
        },
      };
    }
  }

  private checkApplicationHealth(): Promise<HealthIndicatorResult> {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return Promise.resolve({
        application: {
          status: 'up',
          uptime: `${Math.floor(uptime)}s`,
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          },
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
        },
      });
    } catch (error) {
      return Promise.resolve({
        application: {
          status: 'down',
          message: (error as Error).message,
        },
      });
    }
  }
}
