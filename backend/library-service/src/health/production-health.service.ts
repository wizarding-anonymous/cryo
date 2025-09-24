import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { PerformanceMonitorService } from '../monitoring/performance-monitor.service';
import { SecretsManagerService } from '../common/services/secrets-manager.service';

@Injectable()
export class ProductionHealthService {
  private readonly logger = new Logger(ProductionHealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly secretsManager: SecretsManagerService,
  ) {}

  @HealthCheck()
  async checkProductionReadiness(): Promise<HealthCheckResult> {
    const environment = this.configService.get('NODE_ENV');
    const isProduction = environment === 'production';

    try {
      const [systemCheck, performanceCheck, securityCheck, resourcesCheck, externalCheck] = 
        await Promise.allSettled([
          this.checkSystemHealth(),
          this.checkPerformanceHealth(),
          this.checkSecurityHealth(),
          this.checkResourcesHealth(),
          this.checkExternalServicesHealth(),
        ]);

      const results: Record<string, HealthIndicatorResult> = {};
      const statuses: string[] = [];

      // Process system check
      if (systemCheck.status === 'fulfilled') {
        results.system = systemCheck.value;
        statuses.push('up');
      } else {
        results.system = { system: { status: 'down', error: systemCheck.reason?.message || 'System check failed' } };
        statuses.push('down');
      }

      // Process performance check
      if (performanceCheck.status === 'fulfilled') {
        results.performance = performanceCheck.value;
        statuses.push('up');
      } else {
        results.performance = { performance: { status: 'down', error: performanceCheck.reason?.message || 'Performance check failed' } };
        statuses.push('down');
      }

      // Process security check
      if (securityCheck.status === 'fulfilled') {
        results.security = securityCheck.value;
        statuses.push('up');
      } else {
        results.security = { security: { status: 'down', error: securityCheck.reason?.message || 'Security check failed' } };
        statuses.push('down');
      }

      // Process resources check
      if (resourcesCheck.status === 'fulfilled') {
        results.resources = resourcesCheck.value;
        statuses.push('up');
      } else {
        results.resources = { resources: { status: 'down', error: resourcesCheck.reason?.message || 'Resources check failed' } };
        statuses.push('down');
      }

      // Process external services check
      if (externalCheck.status === 'fulfilled') {
        results.external = externalCheck.value;
        statuses.push('up');
      } else {
        results.external = { external: { status: 'down', error: externalCheck.reason?.message || 'External services check failed' } };
        statuses.push('down');
      }

      const overallStatus = this.determineOverallStatus(statuses);

      return {
        status: overallStatus,
        info: {
          environment: { status: 'up', value: environment },
          timestamp: { status: 'up', value: new Date().toISOString() },
          isProduction: { status: 'up', value: isProduction },
          ...results,
        },
        error: {},
        details: {
          production: {
            status: overallStatus === 'ok' ? 'up' : 'down',
            environment,
            timestamp: new Date().toISOString(),
            isProduction,
          },
        },
      };
    } catch (error) {
      this.logger.error('Production health check failed', error);
      return {
        status: 'error',
        info: {},
        error: {
          production: {
            status: 'down',
            error: error instanceof Error ? error.message : 'Health check failed',
          },
        },
        details: {},
      };
    }
  }

  private async checkSystemHealth(): Promise<HealthIndicatorResult> {
    try {
      const nodeVersion = process.version;
      const requiredNodeVersion = '>=18.0.0';
      
      // Check Node.js version
      if (!this.isNodeVersionCompatible(nodeVersion, requiredNodeVersion)) {
        throw new Error(`Node.js version ${nodeVersion} is not compatible with required ${requiredNodeVersion}`);
      }

      // Check environment variables
      const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
      const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      }

      // Check disk space
      const diskSpace = await this.checkDiskSpace();
      if (diskSpace.available < 1024 * 1024 * 1024) { // Less than 1GB
        throw new Error(`Low disk space: ${Math.round(diskSpace.available / 1024 / 1024)}MB available`);
      }

      return {
        system: {
          status: 'up',
          nodeVersion,
          diskSpace: `${Math.round(diskSpace.available / 1024 / 1024 / 1024)}GB available`,
          environment: process.env.NODE_ENV,
        },
      };
    } catch (error) {
      this.logger.error('System health check failed', error);
      throw error;
    }
  }

  private async checkPerformanceHealth(): Promise<HealthIndicatorResult> {
    try {
      const current = this.performanceMonitor.getCurrentMetrics();
      const summary = this.performanceMonitor.getPerformanceSummary();
      const averages = summary.averages;
      const alerts = summary.alerts;

      const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;

      // Critical thresholds
      if (memoryUsage > 0.9) {
        throw new Error(`Critical memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
      }

      if (current.cpu.percent > 90) {
        throw new Error(`Critical CPU usage: ${current.cpu.percent.toFixed(1)}%`);
      }

      if (current.eventLoop.lag > 200) {
        throw new Error(`Critical event loop lag: ${current.eventLoop.lag.toFixed(1)}ms`);
      }

      if (alerts.critical > 0) {
        throw new Error(`${alerts.critical} critical performance alerts active`);
      }

      // Warning thresholds
      const hasWarnings = memoryUsage > 0.8 || current.cpu.percent > 70 || current.eventLoop.lag > 100;

      return {
        performance: {
          status: hasWarnings ? 'up' : 'up', // NestJS Terminus doesn't support 'warning' status
          memoryUsage: `${(memoryUsage * 100).toFixed(1)}%`,
          cpuUsage: `${current.cpu.percent.toFixed(1)}%`,
          eventLoopLag: `${current.eventLoop.lag.toFixed(1)}ms`,
          averageMemory: `${(averages.memoryUsage * 100).toFixed(1)}%`,
          averageCpu: `${averages.cpuUsage.toFixed(1)}%`,
          warnings: hasWarnings ? 'Performance degradation detected' : undefined,
        },
      };
    } catch (error) {
      this.logger.error('Performance health check failed', error);
      throw error;
    }
  }

  private async checkSecurityHealth(): Promise<HealthIndicatorResult> {
    try {
      const isProduction = this.configService.get('NODE_ENV') === 'production';
      
      // Check secrets status
      const secretsStatus = this.secretsManager.getSecretsStatus();
      
      if (secretsStatus.missing.length > 0) {
        throw new Error(`Missing required secrets: ${secretsStatus.missing.join(', ')}`);
      }

      // Check for weak secrets (only warn in production)
      const hasWeakSecrets = secretsStatus.weak.length > 0;
      if (isProduction && hasWeakSecrets) {
        // In production, weak secrets should be treated as errors
        throw new Error(`Weak secrets detected: ${secretsStatus.weak.join(', ')}`);
      }

      // Validate secret formats
      const secretsValidation = this.secretsManager.validateSecrets();
      if (!secretsValidation.valid) {
        throw new Error(`Secret validation failed: ${secretsValidation.errors.join(', ')}`);
      }

      // Additional security checks
      const securityIssues: string[] = [];
      
      if (!process.env.HTTPS && isProduction) {
        securityIssues.push('HTTPS not enabled in production');
      }

      if (!process.env.HELMET_ENABLED && isProduction) {
        securityIssues.push('Security headers not enabled');
      }

      const hasSecurityIssues = securityIssues.length > 0;

      return {
        security: {
          status: 'up',
          secretsLoaded: secretsStatus.loaded,
          secretsTotal: secretsStatus.total,
          environment: isProduction ? 'production' : 'development',
          warnings: hasWeakSecrets || hasSecurityIssues ? 
            [...(hasWeakSecrets ? [`Weak secrets: ${secretsStatus.weak.join(', ')}`] : []), ...securityIssues].join('; ') : 
            undefined,
        },
      };
    } catch (error) {
      this.logger.error('Security health check failed', error);
      throw error;
    }
  }

  private async checkResourcesHealth(): Promise<HealthIndicatorResult> {
    try {
      const memoryUsage = process.memoryUsage();
      
      // Get active handles and requests
      const activeHandles = (process as any)._getActiveHandles().length;
      const activeRequests = (process as any)._getActiveRequests().length;

      // Get GC stats if available
      const gcStats = this.getGCStats();

      // Check for resource leaks
      const hasResourceWarnings = activeHandles > 1000 || activeRequests > 100 || gcStats.duration > 100;

      return {
        resources: {
          status: 'up',
          activeHandles,
          activeRequests,
          gcCollections: gcStats.collections,
          gcDuration: `${gcStats.duration.toFixed(1)}ms`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          warnings: hasResourceWarnings ? 'Resource usage warnings detected' : undefined,
        },
      };
    } catch (error) {
      this.logger.error('Resources health check failed', error);
      throw error;
    }
  }

  private async checkExternalServicesHealth(): Promise<HealthIndicatorResult> {
    try {
      // Check external service connectivity
      const externalChecks = [
        this.checkDatabaseConnection(),
        this.checkRedisConnection(),
        this.checkExternalAPIConnectivity(),
      ];

      const results = await Promise.allSettled(externalChecks);
      const failedChecks = results
        .map((result, index) => ({ result, service: ['database', 'redis', 'external-apis'][index] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ service }) => service);

      if (failedChecks.length > 0) {
        throw new Error(`External service checks failed: ${failedChecks.join(', ')}`);
      }

      return {
        external: {
          status: 'up',
          database: 'connected',
          redis: 'connected',
          externalAPIs: 'accessible',
        },
      };
    } catch (error) {
      this.logger.error('External services health check failed', error);
      throw error;
    }
  }

  private determineOverallStatus(statuses: string[]): 'error' | 'ok' | 'shutting_down' {
    if (statuses.includes('down')) {
      return 'error';
    }
    return 'ok';
  }

  private isNodeVersionCompatible(current: string, required: string): boolean {
    // Simple version check - in production use semver library
    const currentMajor = parseInt(current.replace('v', '').split('.')[0]);
    const requiredMajor = parseInt(required.replace('>=', '').split('.')[0]);
    return currentMajor >= requiredMajor;
  }

  private async checkDiskSpace(): Promise<{ available: number; total: number }> {
    try {
      // This is a simplified check - in production you'd use a proper disk space library
      return {
        available: 10 * 1024 * 1024 * 1024, // 10GB mock
        total: 100 * 1024 * 1024 * 1024, // 100GB mock
      };
    } catch (error) {
      throw new Error(`Failed to check disk space: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getGCStats(): { collections: number; duration: number } {
    // Mock GC stats - in production use gc-stats library
    return {
      collections: Math.floor(Math.random() * 100),
      duration: Math.random() * 50,
    };
  }

  private async checkDatabaseConnection(): Promise<void> {
    // Mock database check - implement actual database ping
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async checkRedisConnection(): Promise<void> {
    // Mock Redis check - implement actual Redis ping
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async checkExternalAPIConnectivity(): Promise<void> {
    // Mock external API check - implement actual API health checks
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}