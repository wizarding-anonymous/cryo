import { Injectable, HttpStatus, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async check() {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    const isHealthy = database.status === 'ok' && redis.status === 'ok';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database,
        redis,
      },
    };
  }

  async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        message: 'Database connection is healthy',
        responseTime: Date.now(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkRedis() {
    try {
      const testKey = 'health-check';
      const testValue = Date.now().toString();

      await this.cacheManager.set(testKey, testValue, 1000); // 1 second TTL
      const retrievedValue = await this.cacheManager.get(testKey);

      if (retrievedValue === testValue) {
        return {
          status: 'ok',
          message: 'Redis connection is healthy',
          responseTime: Date.now(),
        };
      } else {
        return {
          status: 'error',
          message: 'Redis read/write test failed',
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Redis connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
