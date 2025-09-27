import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentValidatorService } from '../config/environment-validator.service';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { RedisService } from '../redis/redis.service';

export interface ReadinessCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
}

@Injectable()
export class ProductionReadinessService implements OnModuleInit {
  private readonly logger = new Logger(ProductionReadinessService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly environmentValidator: EnvironmentValidatorService,
    private readonly serviceRegistry: ServiceRegistryService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (isProduction) {
      this.logger.log('Performing production readiness checks...');
      const checks = await this.performReadinessChecks();

      const failedChecks = checks.filter(
        (check) => check.status === 'unhealthy',
      );
      if (failedChecks.length > 0) {
        this.logger.error(`❌ ${failedChecks.length} readiness checks failed:`);
        failedChecks.forEach((check) => {
          this.logger.error(`  - ${check.name}: ${check.message}`);
        });

        // In production, we might want to exit if critical checks fail
        const criticalChecks = ['Environment Variables', 'Redis Connection'];
        const criticalFailures = failedChecks.filter((check) =>
          criticalChecks.includes(check.name),
        );

        if (criticalFailures.length > 0) {
          this.logger.error(
            'Critical readiness checks failed. Application may not function properly.',
          );
          // Uncomment the next line if you want to exit on critical failures
          // process.exit(1);
        }
      } else {
        this.logger.log('✅ All production readiness checks passed');
      }
    }
  }

  async performReadinessChecks(): Promise<ReadinessCheck[]> {
    const checks: ReadinessCheck[] = [];

    // Environment validation
    checks.push(await this.checkEnvironmentVariables());

    // Redis connectivity
    checks.push(await this.checkRedisConnection());

    // Service registry
    checks.push(await this.checkServiceRegistry());

    // Memory and performance
    checks.push(this.checkMemoryConfiguration());

    // Security configuration
    checks.push(this.checkSecurityConfiguration());

    return checks;
  }

  private async checkEnvironmentVariables(): Promise<ReadinessCheck> {
    try {
      const validation =
        this.environmentValidator.validateProductionEnvironment();

      return {
        name: 'Environment Variables',
        status: validation.isValid ? 'healthy' : 'unhealthy',
        message: validation.isValid
          ? 'All required environment variables are set'
          : `Missing variables: ${validation.errors.join(', ')}`,
        details: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      };
    } catch (error) {
      return {
        name: 'Environment Variables',
        status: 'unhealthy',
        message: `Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkRedisConnection(): Promise<ReadinessCheck> {
    try {
      const client = this.redisService.getClient();
      await client.ping();

      return {
        name: 'Redis Connection',
        status: 'healthy',
        message: 'Redis connection is healthy',
      };
    } catch (error) {
      return {
        name: 'Redis Connection',
        status: 'unhealthy',
        message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkServiceRegistry(): Promise<ReadinessCheck> {
    try {
      const serviceNames = this.serviceRegistry.getAllServiceNames();

      // Check health of each service
      const healthChecks = await Promise.allSettled(
        serviceNames.map((name) =>
          this.serviceRegistry.checkServiceHealth(name),
        ),
      );

      const healthyCount = healthChecks.filter(
        (result) => result.status === 'fulfilled' && result.value === true,
      ).length;

      const status =
        healthyCount === serviceNames.length
          ? 'healthy'
          : healthyCount > 0
            ? 'degraded'
            : 'unhealthy';

      return {
        name: 'Service Registry',
        status,
        message: `${healthyCount}/${serviceNames.length} services are healthy`,
        details: {
          totalServices: serviceNames.length,
          healthyServices: healthyCount,
          services: serviceNames.map((name, index) => ({
            name,
            healthy:
              healthChecks[index].status === 'fulfilled' &&
              healthChecks[index].value === true,
          })),
        },
      };
    } catch (error) {
      return {
        name: 'Service Registry',
        status: 'unhealthy',
        message: `Service registry check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private checkMemoryConfiguration(): ReadinessCheck {
    const nodeOptions = process.env.NODE_OPTIONS || '';
    const uvThreadPoolSize = process.env.UV_THREADPOOL_SIZE;

    const warnings: string[] = [];

    if (!nodeOptions.includes('--max-old-space-size')) {
      warnings.push('NODE_OPTIONS missing --max-old-space-size');
    }

    if (!uvThreadPoolSize || parseInt(uvThreadPoolSize) < 16) {
      warnings.push('UV_THREADPOOL_SIZE should be at least 16 for production');
    }

    return {
      name: 'Memory Configuration',
      status: warnings.length === 0 ? 'healthy' : 'degraded',
      message:
        warnings.length === 0
          ? 'Memory configuration is optimal'
          : `Configuration warnings: ${warnings.join(', ')}`,
      details: {
        nodeOptions,
        uvThreadPoolSize,
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  private checkSecurityConfiguration(): ReadinessCheck {
    const corsOrigin = this.configService.get('CORS_ORIGIN', '*');
    const rateLimitEnabled = this.configService.get('RATE_LIMIT_ENABLED', true);
    const logLevel = this.configService.get('LOG_LEVEL', 'log');

    const warnings: string[] = [];

    if (corsOrigin === '*') {
      warnings.push('CORS origin is set to wildcard');
    }

    if (!rateLimitEnabled) {
      warnings.push('Rate limiting is disabled');
    }

    if (logLevel === 'debug' || logLevel === 'verbose') {
      warnings.push(`Log level '${logLevel}' may be too verbose`);
    }

    return {
      name: 'Security Configuration',
      status: warnings.length === 0 ? 'healthy' : 'degraded',
      message:
        warnings.length === 0
          ? 'Security configuration is optimal'
          : `Security warnings: ${warnings.join(', ')}`,
      details: {
        corsOrigin,
        rateLimitEnabled,
        logLevel,
      },
    };
  }
}
