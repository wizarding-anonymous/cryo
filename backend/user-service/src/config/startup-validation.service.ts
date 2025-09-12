import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from './config.service';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as Redis from 'ioredis';

@Injectable()
export class StartupValidationService implements OnModuleInit {
  private readonly logger = new Logger(StartupValidationService.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async onModuleInit() {
    this.logger.log('Starting application validation...');

    try {
      await this.validateEnvironment();
      await this.validateDatabaseConnection();
      
      // Redis validation is non-critical, don't fail startup if it fails
      try {
        this.logger.log('Attempting Redis validation...');
        await this.validateRedisConnection();
      } catch (redisError) {
        this.logger.warn(`⚠️ Redis validation failed (non-critical): ${redisError.message}`);
      }
      
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

    const redisConfig = this.configService.redisConfig;
    this.logger.log(`Redis config: ${JSON.stringify(redisConfig)}`);
    this.logger.log(`Attempting to connect to Redis at ${redisConfig.host}:${redisConfig.port}`);
    
    let redisClient: Redis.Redis | null = null;

    try {
      // Create a direct Redis connection for validation
      redisClient = new Redis.Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 3000,
        commandTimeout: 3000,
      });

      // Add retry logic for Redis connection
      let retries = 3;
      let lastError: Error;

      while (retries > 0) {
        try {
          this.logger.log(`Redis connection attempt ${4 - retries}/3...`);
          
          // Test direct Redis connection
          await redisClient.connect();
          this.logger.log('Redis connected, testing ping...');
          
          await redisClient.ping();
          this.logger.log('Redis ping successful, testing operations...');

          // Test set/get operations
          const testKey = 'startup-validation-test';
          const testValue = 'test-value';

          await redisClient.set(testKey, testValue, 'EX', 10); // 10 seconds TTL
          const retrievedValue = await redisClient.get(testKey);

          if (retrievedValue !== testValue) {
            throw new Error('Redis set/get test failed');
          }

          // Clean up test key
          await redisClient.del(testKey);

          this.logger.log(
            `✅ Redis connection validated (${redisConfig.host}:${redisConfig.port})`,
          );
          return;
        } catch (error) {
          lastError = error;
          retries--;
          this.logger.warn(`Redis validation attempt failed: ${error.message}`);
          if (retries > 0) {
            this.logger.warn(`Retrying in 1 second... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      throw new Error(`Redis validation failed after retries: ${lastError.message}`);
    } catch (error) {
      this.logger.error(`Redis validation error: ${error.message}`);
      throw new Error(`Redis validation failed: ${error.message}`);
    } finally {
      // Clean up the Redis connection
      if (redisClient) {
        try {
          await redisClient.quit();
        } catch (error) {
          this.logger.warn('Failed to close Redis connection:', error.message);
        }
      }
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

    // Redis check using direct connection only
    try {
      const redisConfig = this.configService.redisConfig;
      const redisClient = new Redis.Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        lazyConnect: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        maxRetriesPerRequest: 1,
      });

      try {
        await redisClient.connect();
        await redisClient.ping();
        
        // Test basic operations
        const testKey = 'health-check-direct-test';
        await redisClient.set(testKey, 'test', 'EX', 5);
        const testValue = await redisClient.get(testKey);
        await redisClient.del(testKey);
        
        if (testValue === 'test') {
          checks.redis = { status: 'pass', message: 'Direct Redis connection successful' };
        } else {
          throw new Error('Redis operations test failed');
        }
      } finally {
        try {
          await redisClient.quit();
        } catch (quitError) {
          // Ignore quit errors in health check
        }
      }
    } catch (error) {
      // Log the error but don't fail the entire health check
      this.logger.warn(`Redis health check failed: ${error.message}`);
      checks.redis = { status: 'fail', message: error.message };
      // Don't set overallStatus to unhealthy for Redis failures in health check
      // Redis is used for caching, not critical functionality
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
