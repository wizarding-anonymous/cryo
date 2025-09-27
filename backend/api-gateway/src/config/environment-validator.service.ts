import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class EnvironmentValidatorService {
  private readonly logger = new Logger(EnvironmentValidatorService.name);

  constructor(private readonly configService: ConfigService) {}

  validateProductionEnvironment(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!isProduction) {
      this.logger.log(
        'Skipping production validation for non-production environment',
      );
      return result;
    }

    // Critical environment variables
    const criticalVars = [
      'REDIS_HOST',
      'SERVICE_USER_BASE_URL',
      'SERVICE_GAME_CATALOG_BASE_URL',
      'SERVICE_PAYMENT_BASE_URL',
      'SERVICE_LIBRARY_BASE_URL',
      'SERVICE_NOTIFICATION_BASE_URL',
    ];

    // Check critical variables
    for (const varName of criticalVars) {
      const value = this.configService.get(varName);
      if (!value) {
        result.errors.push(`Missing critical environment variable: ${varName}`);
        result.isValid = false;
      }
    }

    // Security validations
    this.validateSecurity(result);

    // Performance validations
    this.validatePerformance(result);

    // Service configuration validations
    this.validateServiceConfiguration(result);

    if (result.errors.length > 0) {
      this.logger.error(
        `Production validation failed with ${result.errors.length} errors`,
      );
      result.errors.forEach((error) => this.logger.error(`❌ ${error}`));
    }

    if (result.warnings.length > 0) {
      this.logger.warn(
        `Production validation completed with ${result.warnings.length} warnings`,
      );
      result.warnings.forEach((warning) => this.logger.warn(`⚠️  ${warning}`));
    }

    if (result.isValid && result.errors.length === 0) {
      this.logger.log('✅ Production environment validation passed');
    }

    return result;
  }

  private validateSecurity(result: ValidationResult): void {
    // CORS validation
    const corsOrigin = this.configService.get('CORS_ORIGIN', '*');
    if (corsOrigin === '*') {
      result.warnings.push(
        'CORS_ORIGIN is set to wildcard (*). Consider setting specific origins for production security.',
      );
    }

    // Rate limiting validation
    const rateLimitEnabled = this.configService.get('RATE_LIMIT_ENABLED', true);
    if (!rateLimitEnabled) {
      result.warnings.push('Rate limiting is disabled in production');
    }

    // Log level validation
    const logLevel = this.configService.get('LOG_LEVEL', 'log');
    if (logLevel === 'debug' || logLevel === 'verbose') {
      result.warnings.push(
        `Log level '${logLevel}' may be too verbose for production. Consider 'warn' or 'error'.`,
      );
    }
  }

  private validatePerformance(result: ValidationResult): void {
    // Node.js memory settings
    const nodeOptions = process.env.NODE_OPTIONS || '';
    if (!nodeOptions.includes('--max-old-space-size')) {
      result.warnings.push(
        'NODE_OPTIONS does not include --max-old-space-size. Consider setting for production optimization.',
      );
    }

    // UV thread pool size
    const uvThreadPoolSize = process.env.UV_THREADPOOL_SIZE;
    if (!uvThreadPoolSize || parseInt(uvThreadPoolSize) < 16) {
      result.warnings.push(
        'UV_THREADPOOL_SIZE should be set to at least 16 for production workloads.',
      );
    }

    // Service timeouts
    const serviceTimeout = this.configService.get(
      'SERVICE_DEFAULT_TIMEOUT_MS',
      5000,
    );
    if (serviceTimeout > 30000) {
      result.warnings.push(
        `Service timeout (${serviceTimeout}ms) is very high. Consider reducing for better user experience.`,
      );
    }
  }

  private validateServiceConfiguration(result: ValidationResult): void {
    // Validate service URLs are not localhost in production
    const serviceUrls = [
      'SERVICE_USER_BASE_URL',
      'SERVICE_GAME_CATALOG_BASE_URL',
      'SERVICE_PAYMENT_BASE_URL',
      'SERVICE_LIBRARY_BASE_URL',
      'SERVICE_NOTIFICATION_BASE_URL',
    ];

    for (const urlVar of serviceUrls) {
      const url = this.configService.get(urlVar);
      if (url && url.includes('localhost')) {
        result.errors.push(
          `${urlVar} contains 'localhost' which is not suitable for production: ${url}`,
        );
        result.isValid = false;
      }
    }

    // Redis configuration
    const redisHost = this.configService.get('REDIS_HOST');
    if (redisHost === 'localhost') {
      result.errors.push(
        'REDIS_HOST is set to localhost which is not suitable for production',
      );
      result.isValid = false;
    }

    // Cache configuration
    const cacheEnabled = this.configService.get('CACHE_ENABLED', true);
    if (!cacheEnabled) {
      result.warnings.push(
        'Response caching is disabled, which may impact performance',
      );
    }
  }

  validateStartup(): boolean {
    const result = this.validateProductionEnvironment();

    if (!result.isValid) {
      this.logger.error(
        '❌ Production environment validation failed. Application cannot start.',
      );
      return false;
    }

    return true;
  }
}
