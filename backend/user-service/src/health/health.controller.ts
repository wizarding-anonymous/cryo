import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { StartupValidationService } from '../config/startup-validation.service';
import { AppConfigService } from '../config/config.service';
import { RedisService } from '../common/redis/redis.service';
import { CacheService } from '../common/cache/cache.service';
import { AuthServiceClient } from '../integrations/auth/auth-service.client';
import { SecurityClient } from '../integrations/security/security.client';
import { MetricsService } from '../common/metrics/metrics.service';
import { SystemMetricsService } from '../common/metrics/system-metrics.service';

@Controller('v1/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly startupValidation: StartupValidationService,
    private readonly configService: AppConfigService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
    private readonly authServiceClient: AuthServiceClient,
    private readonly securityClient: SecurityClient,
    private readonly metricsService: MetricsService,
    private readonly systemMetricsService: SystemMetricsService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const timeout = this.configService.healthCheckTimeout;

    return this.health.check([
      // Database check with configurable timeout
      () => this.db.pingCheck('database', { timeout }),
      // Memory checks with reasonable limits
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 250 * 1024 * 1024),
      // Disk space check
      () => this.disk.checkStorage('storage', { path: '/', threshold: 0.9 }),
      // Redis health check (non-critical)
      () => this.performRedisHealthCheck(),
      // Cache service health check (non-critical)
      () => this.performCacheHealthCheck(),
      // External services health checks (non-critical)
      () => this.performAuthServiceHealthCheck(),
      () => this.performSecurityServiceHealthCheck(),
      // Custom validation check
      () => this.performCustomHealthCheck(),
    ]);
  }

  @Get('detailed')
  async detailedCheck() {
    const result = await this.startupValidation.performHealthCheck();
    const cacheStats = await this.cacheService.getCacheStats();
    const cacheInfo = await this.cacheService.getCacheInfo();

    return {
      timestamp: new Date().toISOString(),
      service: this.configService.serviceName,
      version: this.configService.serviceVersion,
      environment: this.configService.nodeEnv,
      cache: {
        stats: cacheStats,
        info: cacheInfo,
      },
      ...result,
    };
  }

  @Get('metrics')
  async getHealthMetrics() {
    const startTime = Date.now();
    
    // Collect health metrics from all components
    const [
      dbCheck,
      redisCheck,
      cacheCheck,
      authServiceCheck,
      securityServiceCheck,
      memoryStats,
      cacheStats,
      serviceMetrics,
    ] = await Promise.allSettled([
      this.performDatabaseMetrics(),
      this.performRedisMetrics(),
      this.performCacheMetrics(),
      this.performAuthServiceHealthCheck(),
      this.performSecurityServiceHealthCheck(),
      this.getMemoryMetrics(),
      this.cacheService.getCacheStats(),
      this.getServiceHealthMetrics(),
    ]);

    const totalLatency = Date.now() - startTime;

    // Determine overall health status
    const criticalComponents = [dbCheck, redisCheck];
    const overallHealth = criticalComponents.every(
      result => result.status === 'fulfilled' && 
      this.getResultValue(result)?.status !== 'unhealthy'
    ) ? 'healthy' : 'degraded';

    return {
      timestamp: new Date().toISOString(),
      service: {
        name: this.configService.serviceName,
        version: this.configService.serviceVersion,
        environment: this.configService.nodeEnv,
        uptime: process.uptime(),
      },
      health: {
        overall: overallHealth,
        totalLatency: `${totalLatency}ms`,
        components: {
          database: this.getResultValue(dbCheck),
          redis: this.getResultValue(redisCheck),
          cache: this.getResultValue(cacheCheck),
          authService: this.getResultValue(authServiceCheck),
          securityService: this.getResultValue(securityServiceCheck),
        },
      },
      metrics: {
        memory: this.getResultValue(memoryStats),
        cache: this.getResultValue(cacheStats),
        service: this.getResultValue(serviceMetrics),
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
      },
    };
  }

  @Get('ready')
  @HealthCheck()
  readinessCheck() {
    // Kubernetes readiness probe - check if service is ready to receive traffic
    // Only check critical dependencies that must be available for the service to function
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.performRedisHealthCheck(),
      // External services are checked but don't fail the readiness probe
      () => this.performExternalServicesReadinessCheck(),
    ]);
  }

  @Get('live')
  @HealthCheck()
  livenessCheck() {
    // Kubernetes liveness probe - basic service health
    // Only check if the service itself is alive, not external dependencies
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.disk.checkStorage('storage', { path: '/', threshold: 0.95 }),
    ]);
  }

  private async performRedisHealthCheck(): Promise<{ [key: string]: any }> {
    try {
      const isHealthy = await this.redisService.healthCheck();
      return {
        redis: {
          status: isHealthy ? 'up' : 'down',
          message: isHealthy
            ? 'Redis connection is healthy'
            : 'Redis connection failed',
        },
      };
    } catch (error) {
      // Redis is non-critical, so we don't throw an error
      return {
        redis: {
          status: 'down',
          message: `Redis health check failed: ${error.message}`,
        },
      };
    }
  }

  private async performCacheHealthCheck(): Promise<{ [key: string]: any }> {
    try {
      const isHealthy = await this.cacheService.healthCheck();
      const stats = await this.cacheService.getCacheStats();

      return {
        cache: {
          status: isHealthy ? 'up' : 'down',
          message: isHealthy
            ? 'Cache service is healthy'
            : 'Cache service failed',
          stats: {
            hitRatio: stats.hitRatio,
            totalOperations: stats.totalOperations,
            averageLatency: stats.averageLatency,
          },
        },
      };
    } catch (error) {
      // Cache is non-critical, so we don't throw an error
      return {
        cache: {
          status: 'down',
          message: `Cache health check failed: ${error.message}`,
        },
      };
    }
  }

  private async performAuthServiceHealthCheck(): Promise<{ [key: string]: any }> {
    try {
      const startTime = Date.now();
      const isHealthy = await this.authServiceClient.healthCheck();
      const latency = Date.now() - startTime;

      return {
        'auth-service': {
          status: isHealthy ? 'up' : 'down',
          message: isHealthy
            ? 'Auth Service is healthy'
            : 'Auth Service is not responding',
          latency: `${latency}ms`,
          critical: false, // Auth Service is not critical for basic user operations
        },
      };
    } catch (error) {
      return {
        'auth-service': {
          status: 'down',
          message: `Auth Service health check failed: ${error.message}`,
          critical: false,
        },
      };
    }
  }

  private async performSecurityServiceHealthCheck(): Promise<{ [key: string]: any }> {
    try {
      const healthResult = await this.securityClient.healthCheck();

      return {
        'security-service': {
          status: healthResult.status === 'healthy' ? 'up' : 'down',
          message: healthResult.status === 'healthy'
            ? 'Security Service is healthy'
            : 'Security Service is not responding',
          latency: healthResult.latency ? `${healthResult.latency}ms` : 'unknown',
          critical: false, // Security Service is not critical for basic user operations
        },
      };
    } catch (error) {
      return {
        'security-service': {
          status: 'down',
          message: `Security Service health check failed: ${error.message}`,
          critical: false,
        },
      };
    }
  }

  private async performExternalServicesReadinessCheck(): Promise<{ [key: string]: any }> {
    // Check external services but don't fail the readiness probe if they're down
    // This provides visibility into external service status without blocking traffic
    const authCheck = await this.performAuthServiceHealthCheck();
    const securityCheck = await this.performSecurityServiceHealthCheck();

    const externalServicesStatus = {
      authService: authCheck['auth-service'].status,
      securityService: securityCheck['security-service'].status,
    };

    const healthyServices = Object.values(externalServicesStatus).filter(status => status === 'up').length;
    const totalServices = Object.keys(externalServicesStatus).length;

    return {
      'external-services': {
        status: 'up', // Always up to not block readiness
        message: `External services status: ${healthyServices}/${totalServices} healthy`,
        details: externalServicesStatus,
        critical: false,
      },
    };
  }

  private async performDatabaseMetrics(): Promise<{ [key: string]: any }> {
    try {
      const startTime = Date.now();
      await this.db.pingCheck('database', { timeout: 3000 });
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        latency: `${latency}ms`,
        type: 'PostgreSQL',
        critical: true,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        type: 'PostgreSQL',
        critical: true,
      };
    }
  }

  private async performRedisMetrics(): Promise<{ [key: string]: any }> {
    try {
      const startTime = Date.now();
      const isHealthy = await this.redisService.healthCheck();
      const latency = Date.now() - startTime;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency: `${latency}ms`,
        type: 'Redis',
        critical: false,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        type: 'Redis',
        critical: false,
      };
    }
  }

  private async performCacheMetrics(): Promise<{ [key: string]: any }> {
    try {
      const startTime = Date.now();
      const isHealthy = await this.cacheService.healthCheck();
      const latency = Date.now() - startTime;
      const stats = await this.cacheService.getCacheStats();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency: `${latency}ms`,
        hitRatio: stats.hitRatio,
        totalOperations: stats.totalOperations,
        averageLatency: stats.averageLatency,
        critical: false,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        critical: false,
      };
    }
  }

  private getMemoryMetrics(): { [key: string]: any } {
    const memUsage = process.memoryUsage();
    
    return {
      heap: {
        used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        limit: '250MB',
        percentage: Math.round((memUsage.heapUsed / (250 * 1024 * 1024)) * 100),
      },
      rss: {
        used: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        limit: '250MB',
        percentage: Math.round((memUsage.rss / (250 * 1024 * 1024)) * 100),
      },
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)}MB`,
    };
  }

  private getResultValue(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'error',
        error: result.reason?.message || 'Unknown error',
      };
    }
  }

  private async performCustomHealthCheck(): Promise<{ [key: string]: any }> {
    const result = await this.startupValidation.performHealthCheck();

    // Only fail if critical services (database, environment) are down
    // Redis and cache are non-critical for basic functionality
    const criticalFailures = Object.entries(result.checks).filter(
      ([name, check]) =>
        check.status === 'fail' && ['database', 'environment'].includes(name),
    );

    if (criticalFailures.length > 0) {
      const failedChecks = criticalFailures
        .map(([name, check]) => `${name}: ${check.message}`)
        .join(', ');

      throw new Error(`Critical health check failed: ${failedChecks}`);
    }

    return {
      'custom-validation': {
        status: 'up',
        checks: result.checks,
        overall_status: result.status,
      },
    };
  }

  private async getServiceHealthMetrics(): Promise<{ [key: string]: any }> {
    try {
      // Get service-specific health metrics
      const [
        operationMetrics,
        performanceMetrics,
        resourceMetrics,
      ] = await Promise.allSettled([
        this.getOperationMetrics(),
        this.getPerformanceMetrics(),
        this.getResourceMetrics(),
      ]);

      return {
        operations: this.getResultValue(operationMetrics),
        performance: this.getResultValue(performanceMetrics),
        resources: this.getResultValue(resourceMetrics),
        healthScore: await this.calculateHealthScore(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async getOperationMetrics(): Promise<{ [key: string]: any }> {
    try {
      // Get operation metrics from MetricsService if available
      const metricsService = this.getMetricsService();
      if (metricsService) {
        const summary = await metricsService.getMetricsSummary();
        return {
          userOperations: summary.userOperations,
          batchOperations: summary.batchOperations,
          externalServiceCalls: summary.externalServiceCalls,
          slowQueries: summary.slowQueries,
          cacheHitRate: `${summary.cacheHitRate.toFixed(2)}%`,
        };
      }
      return { status: 'metrics_service_unavailable' };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async getPerformanceMetrics(): Promise<{ [key: string]: any }> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        memory: {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: `${Math.round(process.uptime())}s`,
        eventLoopLag: await this.measureEventLoopLag(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async getResourceMetrics(): Promise<{ [key: string]: any }> {
    try {
      const systemMetricsService = this.getSystemMetricsService();
      if (systemMetricsService) {
        const snapshot = await systemMetricsService.getSystemMetricsSnapshot();
        return {
          activeConnections: snapshot.activeConnections,
          databasePoolSize: snapshot.databasePoolSize,
          memoryUsage: `${Math.round(snapshot.memoryUsage / 1024 / 1024)}MB`,
          platform: snapshot.platform,
          nodeVersion: snapshot.nodeVersion,
        };
      }
      return { status: 'system_metrics_service_unavailable' };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async calculateHealthScore(): Promise<number> {
    try {
      let score = 100;
      
      // Check database health (critical - 40 points)
      try {
        await this.db.pingCheck('database', { timeout: 3000 });
      } catch {
        score -= 40;
      }

      // Check Redis health (important - 20 points)
      try {
        const redisHealthy = await this.redisService.healthCheck();
        if (!redisHealthy) score -= 20;
      } catch {
        score -= 20;
      }

      // Check memory usage (important - 20 points)
      const memUsage = process.memoryUsage();
      const memoryUsagePercent = (memUsage.heapUsed / (250 * 1024 * 1024)) * 100;
      if (memoryUsagePercent > 90) score -= 20;
      else if (memoryUsagePercent > 80) score -= 10;

      // Check external services (moderate - 10 points each)
      try {
        const authHealthy = await this.authServiceClient.healthCheck();
        if (!authHealthy) score -= 10;
      } catch {
        score -= 5; // Partial penalty for external service
      }

      try {
        const securityHealthy = await this.securityClient.healthCheck();
        if (securityHealthy.status !== 'healthy') score -= 10;
      } catch {
        score -= 5; // Partial penalty for external service
      }

      return Math.max(0, score);
    } catch (error) {
      return 0;
    }
  }

  private async measureEventLoopLag(): Promise<string> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(`${lag.toFixed(2)}ms`);
      });
    });
  }

  private getMetricsService(): MetricsService {
    return this.metricsService;
  }

  private getSystemMetricsService(): SystemMetricsService {
    return this.systemMetricsService;
  }
}
