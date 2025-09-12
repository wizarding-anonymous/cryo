import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from './config.service';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class StartupValidationService implements OnModuleInit {
  private readonly logger = new Logger(StartupValidationService.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting application validation...');

    try {
      await this.validateEnvironment();
      await this.validateDatabaseConnection();
      await this.validateRedisConnection();
      await this.validateJWTConfiguration();

      this.logger.log('✅ All startup validations passed successfully');
    } catch (error) {
      this.logger.error('❌ Startup validation failed:', error.message);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    this.logger.log('Validating environment variables...');

    try {
      this.configService.validateRequiredEnvVars();

      // Log current environment
      this.logger.log(`Environment: ${this.configService.nodeEnv}`);
      this.logger.log(
        `Service: ${this.configService.serviceName} v${this.configService.serviceVersion}`,
      );
      this.logger.log(`Port: ${this.configService.port}`);

      this.logger.log('✅ Environment validation passed');
    } catch (error) {
      throw new Error(`Environment validation failed: ${error.message}`);
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    this.logger.log('Validating database connection...');

    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      // Test database connection
      await this.dataSource.query('SELECT 1');

      const dbConfig = this.configService.databaseConfig;
      this.logger.log(
        `✅ Database connection validated (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`,
      );
    } catch (error) {
      throw new Error(`Database validation failed: ${error.message}`);
    }
  }

  private async validateRedisConnection(): Promise<void> {
    this.logger.log('Validating Redis connection...');

    try {
      // Test Redis connection by setting and getting a test value
      const testKey = 'startup-validation-test';
      const testValue = 'test-value';

      await this.cacheManager.set(testKey, testValue, 1000); // 1 second TTL
      const retrievedValue = await this.cacheManager.get(testKey);

      if (retrievedValue !== testValue) {
        throw new Error('Redis set/get test failed');
      }

      // Clean up test key
      await this.cacheManager.del(testKey);

      const redisConfig = this.configService.redisConfig;
      this.logger.log(
        `✅ Redis connection validated (${redisConfig.host}:${redisConfig.port})`,
      );
    } catch (error) {
      throw new Error(`Redis validation failed: ${error.message}`);
    }
  }

  private async validateJWTConfiguration(): Promise<void> {
    this.logger.log('Validating JWT configuration...');

    try {
      const jwtConfig = this.configService.jwtConfig;

      if (!jwtConfig.secret || jwtConfig.secret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long');
      }

      // Validate JWT expiration format
      const expiresInRegex = /^(\d+[smhd]|\d+)$/;
      if (!expiresInRegex.test(jwtConfig.expiresIn)) {
        throw new Error('Invalid JWT expires in format');
      }

      this.logger.log(
        `✅ JWT configuration validated (expires: ${jwtConfig.expiresIn})`,
      );
    } catch (error) {
      throw new Error(`JWT validation failed: ${error.message}`);
    }
  }

  // Health check method for runtime validation
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, { status: 'pass' | 'fail'; message?: string }>;
  }> {
    const checks: Record<
      string,
      { status: 'pass' | 'fail'; message?: string }
    > = {};
    let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

    // Database check
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = { status: 'pass' };
    } catch (error) {
      checks.database = { status: 'fail', message: error.message };
      overallStatus = 'unhealthy';
    }

    // Redis check
    try {
      const testKey = 'health-check-test';
      await this.cacheManager.set(testKey, 'test', 1000);
      await this.cacheManager.get(testKey);
      await this.cacheManager.del(testKey);
      checks.redis = { status: 'pass' };
    } catch (error) {
      checks.redis = { status: 'fail', message: error.message };
      overallStatus = 'unhealthy';
    }

    // Environment check
    try {
      this.configService.validateRequiredEnvVars();
      checks.environment = { status: 'pass' };
    } catch (error) {
      checks.environment = { status: 'fail', message: error.message };
      overallStatus = 'unhealthy';
    }

    return { status: overallStatus, checks };
  }
}
