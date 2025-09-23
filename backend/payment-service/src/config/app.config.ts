import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppConfig {
  corsOrigin: string;
  corsCredentials: boolean;
  helmetEnabled: boolean;
  swaggerEnabled: boolean;
}

export interface DatabaseConfig {
  synchronize: boolean;
  logging: boolean | string[];
  poolSize: number;
  ssl: boolean;
}

export interface CacheConfig {
  ttl: number;
  max: number;
}

export interface LoggingConfig {
  level: string;
  fileEnabled: boolean;
}

export interface SecurityConfig {
  bcryptRounds: number;
}

export interface PaymentConfig {
  mode: 'simulation' | 'sandbox' | 'production';
  autoApprove: boolean;
  delayMs: number;
  successRate: number;
}

export interface MonitoringConfig {
  metricsEnabled: boolean;
  healthCheckEnabled: boolean;
}

export interface ExternalConfig {
  timeoutMs: number;
  retryAttempts: number;
}

export interface PaymentProviderConfig {
  sberbank: {
    url: string;
    apiKey: string;
  };
  yandex: {
    url: string;
    apiKey: string;
  };
  tbank: {
    url: string;
    apiKey: string;
  };
}

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get environment(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3003);
  }

  get appUrl(): string {
    return this.configService.get<string>('APP_URL', 'http://localhost:3003');
  }

  get app(): AppConfig {
    return this.configService.get<AppConfig>('app', {
      corsOrigin: this.configService.get<string>(
        'CORS_ORIGIN',
        'http://localhost:3000',
      ),
      corsCredentials: this.configService.get<boolean>(
        'CORS_CREDENTIALS',
        true,
      ),
      helmetEnabled: this.configService.get<boolean>('HELMET_ENABLED', true),
      swaggerEnabled: this.configService.get<boolean>('SWAGGER_ENABLED', false),
    });
  }

  get database(): DatabaseConfig {
    const envConfig = this.configService.get('database') || {};
    return {
      synchronize:
        envConfig.synchronize ??
        this.configService.get<boolean>('database.synchronize', false),
      logging:
        envConfig.logging ??
        this.configService.get<boolean | string[]>('database.logging', false),
      poolSize: this.configService.get<number>('POSTGRES_POOL_SIZE', 10),
      ssl: this.configService.get<boolean>('POSTGRES_SSL', false),
    };
  }

  get cache(): CacheConfig {
    const envConfig = this.configService.get('cache') || {};
    return {
      ttl: envConfig.ttl ?? this.configService.get<number>('REDIS_TTL', 300),
      max: envConfig.max ?? this.configService.get<number>('cache.max', 1000),
    };
  }

  get logging(): LoggingConfig {
    const envConfig = this.configService.get('logging') || {};
    return {
      level:
        envConfig.level ?? this.configService.get<string>('LOG_LEVEL', 'info'),
      fileEnabled:
        envConfig.fileEnabled ??
        this.configService.get<boolean>('LOG_FILE_ENABLED', true),
    };
  }

  get security(): SecurityConfig {
    const envConfig = this.configService.get('security') || {};
    return {
      bcryptRounds:
        envConfig.bcryptRounds ??
        this.configService.get<number>('BCRYPT_ROUNDS', 12),
    };
  }

  get payment(): PaymentConfig {
    const envConfig = this.configService.get('payment') || {};
    return {
      mode:
        envConfig.mode ??
        this.configService.get<'simulation' | 'sandbox' | 'production'>(
          'PAYMENT_MODE',
          'simulation',
        ),
      autoApprove:
        envConfig.autoApprove ??
        this.configService.get<boolean>('PAYMENT_AUTO_APPROVE', true),
      delayMs:
        envConfig.delayMs ??
        this.configService.get<number>('PAYMENT_DELAY_MS', 1000),
      successRate:
        envConfig.successRate ??
        this.configService.get<number>('PAYMENT_SUCCESS_RATE', 0.95),
    };
  }

  get monitoring(): MonitoringConfig {
    const envConfig = this.configService.get('monitoring') || {};
    return {
      metricsEnabled:
        envConfig.metricsEnabled ??
        this.configService.get<boolean>('METRICS_ENABLED', true),
      healthCheckEnabled:
        envConfig.healthCheckEnabled ??
        this.configService.get<boolean>('HEALTH_CHECK_ENABLED', true),
    };
  }

  get external(): ExternalConfig {
    const envConfig = this.configService.get('external') || {};
    return {
      timeoutMs:
        envConfig.timeoutMs ??
        this.configService.get<number>('SERVICE_TIMEOUT_MS', 5000),
      retryAttempts:
        envConfig.retryAttempts ??
        this.configService.get<number>('RETRY_ATTEMPTS', 3),
    };
  }

  get jwt(): { secret: string; expiresIn: string; refreshExpiresIn: string } {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
      refreshExpiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ),
    };
  }

  get throttle(): { ttl: number; limit: number } {
    return {
      ttl: this.configService.get<number>('THROTTLE_TTL', 60),
      limit: this.configService.get<number>('THROTTLE_LIMIT', 100),
    };
  }

  get paymentProviders(): PaymentProviderConfig {
    return {
      sberbank: {
        url: this.configService.get<string>('SBERBANK_MOCK_URL'),
        apiKey: this.configService.get<string>('SBERBANK_MOCK_API_KEY'),
      },
      yandex: {
        url: this.configService.get<string>('YANDEX_MOCK_URL'),
        apiKey: this.configService.get<string>('YANDEX_MOCK_API_KEY'),
      },
      tbank: {
        url: this.configService.get<string>('TBANK_MOCK_URL'),
        apiKey: this.configService.get<string>('TBANK_MOCK_API_KEY'),
      },
    };
  }

  get externalServices(): {
    userService: string;
    gameCatalogService: string;
    libraryService: string;
    eventBusUrl?: string;
  } {
    return {
      userService: this.configService.get<string>('USER_SERVICE_URL'),
      gameCatalogService: this.configService.get<string>(
        'GAME_CATALOG_SERVICE_URL',
      ),
      libraryService: this.configService.get<string>('LIBRARY_SERVICE_URL'),
      eventBusUrl: this.configService.get<string>('EVENT_BUS_URL'),
    };
  }

  get enabledProviders(): string[] {
    const providers = this.configService.get<string>(
      'ENABLED_PROVIDERS',
      'sberbank,yandex,tbank',
    );
    return providers.split(',').map((p) => p.trim());
  }

  // Helper methods for common checks
  get isDevelopment(): boolean {
    return this.environment === 'development';
  }

  get isProduction(): boolean {
    return this.environment === 'production';
  }

  get isTest(): boolean {
    return this.environment === 'test';
  }

  // Database connection string (useful for migrations)
  get databaseUrl(): string {
    const host = this.configService.get<string>('POSTGRES_HOST');
    const port = this.configService.get<number>('POSTGRES_PORT');
    const username = this.configService.get<string>('POSTGRES_USERNAME');
    const password = this.configService.get<string>('POSTGRES_PASSWORD');
    const database = this.configService.get<string>('POSTGRES_DATABASE');

    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  // Redis connection string
  get redisUrl(): string {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_DB', 0);

    if (password) {
      return `redis://:${password}@${host}:${port}/${db}`;
    }
    return `redis://${host}:${port}/${db}`;
  }
}
