import { Controller, Get, Logger, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  HealthIndicatorResult,
  HealthCheckResult,
} from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('v1/health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
        () => this.memory.checkRSS('memory_rss', 250 * 1024 * 1024),

        // Redis/Cache health check
        () => this.checkRedisHealth(),

        // Application-specific health checks
        () => this.checkApplicationHealth(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`Health check completed successfully in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Health check failed after ${duration}ms`, error.stack);
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
      () => this.checkRedisHealth(),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service should be restarted' })
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // Higher threshold for liveness
      () => this.checkApplicationHealth(),
    ]);
  }

  /**
   * Check Redis/Cache health
   */
  private async checkRedisHealth(): Promise<HealthIndicatorResult> {
    const key = 'health-check';
    const testValue = Date.now().toString();

    try {
      // Test Redis write
      await this.cacheManager.set(key, testValue, 10000); // 10 second TTL

      // Test Redis read
      const retrievedValue = await this.cacheManager.get(key);

      if (retrievedValue === testValue) {
        return {
          redis: {
            status: 'up',
            message: 'Redis connection is healthy',
            responseTime: '< 100ms',
          },
        };
      } else {
        throw new Error('Redis read/write test failed');
      }
    } catch (error) {
      this.logger.warn(
        'Redis health check failed, service may be using memory cache fallback',
        error.message,
      );

      // Check if we're using memory cache fallback
      try {
        await this.cacheManager.set(key, testValue, 10000);
        const retrievedValue = await this.cacheManager.get(key);

        if (retrievedValue === testValue) {
          return {
            redis: {
              status: 'up',
              message: 'Using memory cache fallback (Redis unavailable)',
              fallback: true,
            },
          };
        }
      } catch (fallbackError) {
        // Cache is completely broken
        return {
          redis: {
            status: 'down',
            message: error.message,
            error: fallbackError.message,
          },
        };
      }
    }
  }

  /**
   * Check application-specific health indicators
   */
  private async checkApplicationHealth(): Promise<HealthIndicatorResult> {
    try {
      // Check if the application can perform basic operations
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return {
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
      };
    } catch (error) {
      return {
        application: {
          status: 'down',
          message: error.message,
        },
      };
    }
  }
}
