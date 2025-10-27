import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  maxRetries: number;
  retryDelay: number;
}
import { EnvironmentVariables } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService<EnvironmentVariables>) {}

  // Application
  get nodeEnv(): string {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get serviceName(): string {
    return this.configService.get('SERVICE_NAME', { infer: true });
  }

  get serviceVersion(): string {
    return this.configService.get('SERVICE_VERSION', { infer: true });
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Database
  get databaseConfig() {
    return {
      host: this.configService.get('POSTGRES_HOST', { infer: true }),
      port: this.configService.get('POSTGRES_PORT', { infer: true }),
      username: this.configService.get('POSTGRES_USER', { infer: true }),
      password: this.configService.get('POSTGRES_PASSWORD', { infer: true }),
      database: this.configService.get('POSTGRES_DB', { infer: true }),
      maxConnections: this.configService.get('POSTGRES_MAX_CONNECTIONS', {
        infer: true,
      }),
      connectionTimeout: this.configService.get('POSTGRES_CONNECTION_TIMEOUT', {
        infer: true,
      }),
    };
  }

  // Redis
  get redisConfig(): RedisConfig {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379'), 10),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      db: parseInt(this.configService.get<string>('REDIS_DB', '0'), 10),
      maxRetries: parseInt(
        this.configService.get<string>('REDIS_MAX_RETRIES', '3'),
        10,
      ),
      retryDelay: parseInt(
        this.configService.get<string>('REDIS_RETRY_DELAY', '1000'),
        10,
      ),
    };
  }

  // Rate Limiting
  get throttleConfig() {
    return {
      ttl: this.configService.get('THROTTLE_TTL', { infer: true }),
      limit: this.configService.get('THROTTLE_LIMIT', { infer: true }),
      enabled: this.configService.get('RATE_LIMIT_ENABLED', { infer: true }),
    };
  }

  // Logging
  get loggingConfig() {
    return {
      level: this.configService.get('LOG_LEVEL', { infer: true }),
      format: this.configService.get('LOG_FORMAT', { infer: true }),
    };
  }

  // Health Check
  get healthCheckTimeout(): number {
    return this.configService.get('HEALTH_CHECK_TIMEOUT', { infer: true });
  }

  // Metrics
  get metricsConfig() {
    return {
      enabled: this.configService.get('METRICS_ENABLED', { infer: true }),
      port: this.configService.get('METRICS_PORT', { infer: true }),
    };
  }

  // CORS
  get corsConfig() {
    return {
      origin: this.configService.get('CORS_ORIGIN', { infer: true }),
      methods: this.configService.get('CORS_METHODS', { infer: true }),
      credentials: this.configService.get('CORS_CREDENTIALS', { infer: true }),
    };
  }

  // Security
  get securityConfig() {
    return {
      helmetEnabled: this.configService.get('HELMET_ENABLED', { infer: true }),
      rateLimitEnabled: this.configService.get('RATE_LIMIT_ENABLED', {
        infer: true,
      }),
    };
  }

  // External Services
  get externalServices() {
    return {
      gameCatalogServiceUrl: this.configService.get(
        'GAME_CATALOG_SERVICE_URL',
        { infer: true },
      ),
      notificationServiceUrl: this.configService.get(
        'NOTIFICATION_SERVICE_URL',
        { infer: true },
      ),
    };
  }

  // Monitoring
  get monitoringConfig() {
    return {
      sentryDsn: this.configService.get('SENTRY_DSN', { infer: true }),
      jaegerEndpoint: this.configService.get('JAEGER_ENDPOINT', {
        infer: true,
      }),
    };
  }

  // Validation helper
  validateRequiredEnvVars(): void {
    const requiredVars = [
      'POSTGRES_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'REDIS_HOST',
    ];

    const missingVars = requiredVars.filter(
      (varName) =>
        !this.configService.get(varName as keyof EnvironmentVariables),
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`,
      );
    }
  }
}
