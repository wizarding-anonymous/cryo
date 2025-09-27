import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthResponseDto, HealthStatus } from './dto/health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getHealth(): Promise<HealthResponseDto> {
    const checks = await this.performHealthChecks();
    const isHealthy = checks.every(check => check.status === 'healthy');

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'achievement-service',
        version: process.env.npm_package_version || '1.0.0',
        checks,
      });
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'achievement-service',
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  async getReadiness(): Promise<HealthResponseDto> {
    const checks = await this.performReadinessChecks();
    const isReady = checks.every(check => check.status === 'healthy');

    if (!isReady) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'achievement-service',
        version: process.env.npm_package_version || '1.0.0',
        checks,
      });
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'achievement-service',
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  async getLiveness(): Promise<HealthResponseDto> {
    // Простая проверка жизнеспособности - сервис отвечает
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'achievement-service',
      version: process.env.npm_package_version || '1.0.0',
      checks: [
        {
          name: 'service',
          status: 'healthy',
          message: 'Service is alive',
        },
      ],
    };
  }

  private async performHealthChecks(): Promise<HealthStatus[]> {
    const checks: HealthStatus[] = [];

    // Проверка подключения к базе данных
    try {
      await this.dataSource.query('SELECT 1');
      checks.push({
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
      });
    }

    // Проверка памяти
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const maxMemoryMB = 512; // Максимальное использование памяти в MB

    if (memoryUsageMB < maxMemoryMB) {
      checks.push({
        name: 'memory',
        status: 'healthy',
        message: `Memory usage: ${memoryUsageMB}MB`,
      });
    } else {
      checks.push({
        name: 'memory',
        status: 'unhealthy',
        message: `Memory usage too high: ${memoryUsageMB}MB`,
      });
    }

    return checks;
  }

  private async performReadinessChecks(): Promise<HealthStatus[]> {
    const checks: HealthStatus[] = [];

    // Проверка подключения к базе данных
    try {
      await this.dataSource.query('SELECT 1');
      checks.push({
        name: 'database',
        status: 'healthy',
        message: 'Database is ready',
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        message: `Database not ready: ${(error as Error).message}`,
      });
    }

    // Проверка миграций
    try {
      const migrations = await this.dataSource.showMigrations();
      const migrationArray = Array.isArray(migrations) ? migrations : [];
      if (migrationArray.length === 0) {
        checks.push({
          name: 'migrations',
          status: 'healthy',
          message: 'All migrations applied',
        });
      } else {
        checks.push({
          name: 'migrations',
          status: 'unhealthy',
          message: `Pending migrations: ${migrationArray.length}`,
        });
      }
    } catch (error) {
      checks.push({
        name: 'migrations',
        status: 'unhealthy',
        message: `Migration check failed: ${(error as Error).message}`,
      });
    }

    return checks;
  }
}
