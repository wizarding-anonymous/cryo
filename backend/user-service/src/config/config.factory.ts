import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { EnvironmentVariables } from './env.validation';
import { User } from '../user/entities/user.entity';

/**
 * Configuration factory for creating various module configurations
 * based on environment variables and application settings
 */
export class ConfigFactory {
  constructor(private readonly configService: ConfigService<EnvironmentVariables>) {}

  /**
   * Create TypeORM configuration
   */
  createTypeOrmConfig(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const dbConfig = {
      host: this.configService.get('POSTGRES_HOST', { infer: true }),
      port: this.configService.get('POSTGRES_PORT', { infer: true }),
      username: this.configService.get('POSTGRES_USER', { infer: true }),
      password: this.configService.get('POSTGRES_PASSWORD', { infer: true }),
      database: this.configService.get('POSTGRES_DB', { infer: true }),
      maxConnections: this.configService.get('POSTGRES_MAX_CONNECTIONS', { infer: true }),
      connectionTimeout: this.configService.get('POSTGRES_CONNECTION_TIMEOUT', { infer: true }),
    };

    return {
      type: 'postgres',
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      entities: [User],
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      synchronize: false, // Always use migrations
      logging: this.getTypeOrmLogging(nodeEnv),
      extra: {
        max: dbConfig.maxConnections,
        connectionTimeoutMillis: dbConfig.connectionTimeout,
        idleTimeoutMillis: 30000,
        statement_timeout: 60000,
        query_timeout: 60000,
      },
      // Connection pool settings
      poolSize: dbConfig.maxConnections,
      // SSL configuration for production
      ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  /**
   * Create Throttler configuration
   */
  createThrottlerConfig(): ThrottlerModuleOptions {
    const throttleConfig = {
      ttl: this.configService.get('THROTTLE_TTL', { infer: true }),
      limit: this.configService.get('THROTTLE_LIMIT', { infer: true }),
      enabled: this.configService.get('RATE_LIMIT_ENABLED', { infer: true }),
    };

    if (!throttleConfig.enabled) {
      // Return very high limits when rate limiting is disabled
      return {
        throttlers: [{
          name: 'default',
          ttl: throttleConfig.ttl,
          limit: 10000,
        }],
      };
    }

    return {
      throttlers: [{
        name: 'default',
        ttl: throttleConfig.ttl,
        limit: throttleConfig.limit,
      }],
    };
  }

  /**
   * Create Cache configuration
   */
  createCacheConfig(): CacheModuleOptions {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    
    return {
      isGlobal: true,
      ttl: nodeEnv === 'production' ? 300 : 60, // 5 minutes in prod, 1 minute in dev
      max: nodeEnv === 'production' ? 1000 : 100, // More items in production
    };
  }

  /**
   * Create Redis configuration
   */
  createRedisConfig() {
    return {
      host: this.configService.get('REDIS_HOST', { infer: true }),
      port: this.configService.get('REDIS_PORT', { infer: true }),
      password: this.configService.get('REDIS_PASSWORD', { infer: true }),
      db: this.configService.get('REDIS_DB', { infer: true }),
      maxRetriesPerRequest: this.configService.get('REDIS_MAX_RETRIES', { infer: true }),
      retryDelayOnFailover: this.configService.get('REDIS_RETRY_DELAY', { infer: true }),
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  /**
   * Create JWT configuration
   */
  createJwtConfig() {
    return {
      secret: this.configService.get('JWT_SECRET', { infer: true }),
      signOptions: {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', { infer: true }),
      },
    };
  }

  /**
   * Create CORS configuration
   */
  createCorsConfig() {
    const origin = this.configService.get('CORS_ORIGIN', { infer: true });
    const methods = this.configService.get('CORS_METHODS', { infer: true });
    const credentials = this.configService.get('CORS_CREDENTIALS', { infer: true });

    return {
      origin: origin === '*' ? true : origin.split(','),
      methods: methods.split(','),
      credentials,
      optionsSuccessStatus: 200,
    };
  }

  /**
   * Create Swagger configuration
   */
  createSwaggerConfig() {
    const serviceName = this.configService.get('SERVICE_NAME', { infer: true });
    const serviceVersion = this.configService.get('SERVICE_VERSION', { infer: true });
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    return {
      title: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} API`,
      description: `API documentation for the ${serviceName} microservice`,
      version: serviceVersion,
      // Only enable Swagger in non-production environments
      enabled: nodeEnv !== 'production',
    };
  }

  /**
   * Get TypeORM logging configuration based on environment
   */
  private getTypeOrmLogging(nodeEnv: string): boolean | ('query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration')[] {
    switch (nodeEnv) {
      case 'development':
        return ['query', 'error', 'warn', 'migration'];
      case 'test':
        return ['error'];
      case 'production':
        return ['error', 'warn', 'migration'];
      default:
        return ['error'];
    }
  }

  /**
   * Validate critical configuration
   */
  validateConfiguration(): void {
    const requiredVars = [
      'POSTGRES_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'REDIS_HOST',
      'JWT_SECRET',
    ];

    const missingVars = requiredVars.filter(
      (varName) => !this.configService.get(varName as keyof EnvironmentVariables)
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }

    // Validate JWT secret length
    const jwtSecret = this.configService.get('JWT_SECRET', { infer: true });
    if (jwtSecret && jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    // Validate production-specific requirements
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    if (nodeEnv === 'production') {
      this.validateProductionConfig();
    }
  }

  /**
   * Validate production-specific configuration
   */
  private validateProductionConfig(): void {
    const productionChecks = [
      {
        key: 'JWT_SECRET',
        check: (value: string) => value !== 'CHANGE_ME_IN_PRODUCTION_MUST_BE_AT_LEAST_32_CHARACTERS_LONG',
        message: 'JWT_SECRET must be changed from default value in production'
      },
      {
        key: 'POSTGRES_PASSWORD',
        check: (value: string) => value !== 'CHANGE_ME_IN_PRODUCTION',
        message: 'POSTGRES_PASSWORD must be changed from default value in production'
      },
      {
        key: 'REDIS_PASSWORD',
        check: (value: string) => !value || value !== 'CHANGE_ME_IN_PRODUCTION',
        message: 'REDIS_PASSWORD should be set and changed from default value in production'
      },
    ];

    for (const check of productionChecks) {
      const value = this.configService.get(check.key as keyof EnvironmentVariables);
      if (value && !check.check(value as string)) {
        throw new Error(check.message);
      }
    }
  }
}