import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export interface ProductionConfig {
  isProduction: boolean;
  logLevel: string;
  healthCheck: {
    timeout: number;
    retries: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
  };
  security: {
    trustProxy: boolean;
    removeSignature: boolean;
    enableSecurityHeaders: boolean;
  };
  performance: {
    bufferLogs: boolean;
    maxOldSpaceSize: string;
  };
}

export class ProductionConfigService {
  private readonly logger = new Logger(ProductionConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  getProductionConfig(): ProductionConfig {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    const config: ProductionConfig = {
      isProduction,
      logLevel: this.configService.get(
        'LOG_LEVEL',
        isProduction ? 'warn' : 'log',
      ),
      healthCheck: {
        timeout: this.configService.get('HEALTH_CHECK_TIMEOUT_MS', 5000),
        retries: this.configService.get('HEALTH_CHECK_RETRIES', 3),
      },
      circuitBreaker: {
        failureThreshold: this.configService.get(
          'CIRCUIT_BREAKER_FAILURE_THRESHOLD',
          5,
        ),
        resetTimeout: this.configService.get(
          'CIRCUIT_BREAKER_RESET_TIMEOUT_MS',
          60000,
        ),
        monitoringPeriod: this.configService.get(
          'CIRCUIT_BREAKER_MONITORING_PERIOD_MS',
          10000,
        ),
      },
      security: {
        trustProxy: true,
        removeSignature: isProduction,
        enableSecurityHeaders: isProduction,
      },
      performance: {
        bufferLogs: isProduction,
        maxOldSpaceSize: process.env.NODE_OPTIONS?.includes(
          '--max-old-space-size',
        )
          ? process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/)?.[1] ||
            '512'
          : '512',
      },
    };

    if (isProduction) {
      this.logger.log('Production configuration loaded');
      this.logger.log(`Log level: ${config.logLevel}`);
      this.logger.log(`Health check timeout: ${config.healthCheck.timeout}ms`);
      this.logger.log(
        `Circuit breaker threshold: ${config.circuitBreaker.failureThreshold}`,
      );
    }

    return config;
  }

  validateProductionReadiness(): boolean {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!isProduction) {
      return true; // Skip validation for non-production environments
    }

    const requiredEnvVars = [
      'REDIS_HOST',
      'SERVICE_USER_BASE_URL',
      'SERVICE_GAME_CATALOG_BASE_URL',
      'SERVICE_PAYMENT_BASE_URL',
      'SERVICE_LIBRARY_BASE_URL',
      'SERVICE_NOTIFICATION_BASE_URL',
      'SERVICE_REVIEW_BASE_URL',
      'SERVICE_ACHIEVEMENT_BASE_URL',
      'SERVICE_SECURITY_BASE_URL',
      'SERVICE_SOCIAL_BASE_URL',
      'SERVICE_DOWNLOAD_BASE_URL',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !this.configService.get(varName),
    );

    if (missingVars.length > 0) {
      this.logger.error(
        `Production readiness check failed. Missing environment variables: ${missingVars.join(', ')}`,
      );
      return false;
    }

    // Validate CORS origin is not wildcard in production
    const corsOrigin = this.configService.get('CORS_ORIGIN', '*');
    if (corsOrigin === '*') {
      this.logger.warn(
        'CORS_ORIGIN is set to wildcard (*) in production. Consider setting specific origins for security.',
      );
    }

    this.logger.log('Production readiness check passed');
    return true;
  }
}
