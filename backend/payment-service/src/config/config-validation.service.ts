import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const result = this.validateConfiguration();

    if (result.warnings.length > 0) {
      this.logger.warn('Configuration warnings:');
      result.warnings.forEach((warning) => this.logger.warn(`  - ${warning}`));
    }

    if (!result.isValid) {
      this.logger.error('Configuration validation failed:');
      result.errors.forEach((error) => this.logger.error(`  - ${error}`));
      throw new Error('Invalid configuration. Please check the logs above.');
    }

    this.logger.log('Configuration validation passed successfully');
    this.logConfigurationSummary();
  }

  private validateConfiguration(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required configuration validation
    this.validateRequired('JWT_SECRET', errors);
    this.validateRequired('POSTGRES_PASSWORD', errors);

    // JWT Secret strength validation
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push(
        'JWT_SECRET must be at least 32 characters long for security',
      );
    }

    // Environment-specific validations
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );

    // Database password strength validation (relaxed for test environment)
    const dbPassword = this.configService.get<string>('POSTGRES_PASSWORD');
    const minPasswordLength = environment === 'test' ? 4 : 8;
    if (dbPassword && dbPassword.length < minPasswordLength) {
      errors.push(
        `POSTGRES_PASSWORD must be at least ${minPasswordLength} characters long`,
      );
    }

    if (environment === 'production') {
      this.validateProductionConfig(errors, warnings);
    }

    // Payment provider validation
    this.validatePaymentProviders(errors, warnings);

    // External services validation
    this.validateExternalServices(warnings);

    // Port validation
    const port = this.configService.get<number>('PORT');
    if (port && (port < 1 || port > 65535)) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Redis configuration validation
    this.validateRedisConfig(warnings);

    // Database pool size validation
    const poolSize = this.configService.get<number>('POSTGRES_POOL_SIZE', 10);
    if (poolSize < 1 || poolSize > 100) {
      warnings.push('POSTGRES_POOL_SIZE should be between 1 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateRequired(key: string, errors: string[]): void {
    const value = this.configService.get<string>(key);
    if (!value || value.trim() === '') {
      errors.push(`${key} is required but not provided`);
    }
  }

  private validateProductionConfig(errors: string[], warnings: string[]): void {
    // Production-specific validations
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN');
    if (corsOrigin && corsOrigin.includes('localhost')) {
      warnings.push('CORS_ORIGIN contains localhost in production environment');
    }

    const appUrl = this.configService.get<string>('APP_URL');
    if (appUrl && !appUrl.startsWith('https://')) {
      warnings.push('APP_URL should use HTTPS in production');
    }

    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
    if (jwtExpiresIn === '1h') {
      warnings.push(
        'Consider shorter JWT expiration time in production (e.g., 15m)',
      );
    }

    const paymentMode = this.configService.get<string>('PAYMENT_MODE');
    if (paymentMode === 'simulation') {
      warnings.push('PAYMENT_MODE is still set to simulation in production');
    }

    const swaggerEnabled = this.configService.get<boolean>(
      'SWAGGER_ENABLED',
      false,
    );
    if (swaggerEnabled) {
      warnings.push('Swagger documentation is enabled in production');
    }

    // SSL validation
    const postgresSSL = this.configService.get<boolean>('POSTGRES_SSL', false);
    if (!postgresSSL) {
      warnings.push('PostgreSQL SSL is disabled in production');
    }
  }

  private validatePaymentProviders(errors: string[], warnings: string[]): void {
    const enabledProviders = this.configService.get<string>(
      'ENABLED_PROVIDERS',
      '',
    );
    const providers = enabledProviders.split(',').map((p) => p.trim());

    const validProviders = ['sberbank', 'yandex', 'tbank'];
    const invalidProviders = providers.filter(
      (p) => !validProviders.includes(p),
    );

    if (invalidProviders.length > 0) {
      errors.push(`Invalid payment providers: ${invalidProviders.join(', ')}`);
    }

    if (providers.length === 0) {
      warnings.push('No payment providers enabled');
    }

    // Validate provider URLs and keys
    providers.forEach((provider) => {
      const urlKey = `${provider.toUpperCase()}_MOCK_URL`;
      const keyKey = `${provider.toUpperCase()}_MOCK_API_KEY`;

      if (provider === 'yandex') {
        // Handle yandex -> YANDEX mapping
        this.validateRequired('YANDEX_MOCK_URL', errors);
        this.validateRequired('YANDEX_MOCK_API_KEY', errors);
      } else {
        this.validateRequired(urlKey, errors);
        this.validateRequired(keyKey, errors);
      }
    });
  }

  private validateExternalServices(warnings: string[]): void {
    const services = [
      'USER_SERVICE_URL',
      'GAME_CATALOG_SERVICE_URL',
      'LIBRARY_SERVICE_URL',
    ];

    services.forEach((service) => {
      const url = this.configService.get<string>(service);
      if (!url) {
        warnings.push(`${service} is not configured`);
      } else if (
        url.includes('localhost') &&
        this.configService.get<string>('NODE_ENV') === 'production'
      ) {
        warnings.push(`${service} uses localhost in production`);
      }
    });
  }

  private validateRedisConfig(warnings: string[]): void {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');

    if (!redisHost) {
      warnings.push('REDIS_HOST is not configured');
    }

    if (!redisPort || redisPort < 1 || redisPort > 65535) {
      warnings.push('REDIS_PORT should be between 1 and 65535');
    }

    const redisTTL = this.configService.get<number>('REDIS_TTL', 300);
    if (redisTTL < 1) {
      warnings.push('REDIS_TTL should be at least 1 second');
    }
  }

  private logConfigurationSummary(): void {
    const environment = this.configService.get<string>('NODE_ENV');
    const port = this.configService.get<number>('PORT');
    const paymentMode = this.configService.get<string>('PAYMENT_MODE');
    const enabledProviders =
      this.configService.get<string>('ENABLED_PROVIDERS');
    const logLevel = this.configService.get<string>('LOG_LEVEL');

    this.logger.log('=== Configuration Summary ===');
    this.logger.log(`Environment: ${environment}`);
    this.logger.log(`Port: ${port}`);
    this.logger.log(`Payment Mode: ${paymentMode}`);
    this.logger.log(`Enabled Providers: ${enabledProviders}`);
    this.logger.log(`Log Level: ${logLevel}`);
    this.logger.log('============================');
  }

  // Public method to get configuration health status
  getConfigurationHealth(): {
    status: 'healthy' | 'warning' | 'error';
    details: ValidationResult;
  } {
    const result = this.validateConfiguration();

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (result.errors.length > 0) {
      status = 'error';
    } else if (result.warnings.length > 0) {
      status = 'warning';
    }

    return {
      status,
      details: result,
    };
  }
}
