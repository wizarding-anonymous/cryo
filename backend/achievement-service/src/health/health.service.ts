import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthResponseDto, HealthStatus } from './dto/health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  async getHealth(): Promise<HealthResponseDto> {
    const checks = await this.performHealthChecks();
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');

    if (hasUnhealthy) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'achievement-service',
        version: process.env.npm_package_version || '1.0.0',
        checks,
      });
    }

    const overallStatus = hasDegraded ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
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
    // For liveness, we check if the process is running and responsive
    const memoryStatus = this.checkMemoryUsage();

    return {
      status: memoryStatus === 'unhealthy' ? 'unhealthy' : 'alive',
      timestamp: new Date().toISOString(),
      service: 'achievement-service',
      version: process.env.npm_package_version || '1.0.0',
      checks: [
        {
          name: 'service',
          status: 'healthy',
          message: 'Service is alive',
        },
        {
          name: 'memory',
          status: memoryStatus,
          message: this.getMemoryStatusMessage(),
        },
      ],
    };
  }

  private async performHealthChecks(): Promise<HealthStatus[]> {
    const checks: HealthStatus[] = [];

    // Проверка подключения к базе данных
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      checks.push({
        name: 'database',
        status: 'healthy',
        message: `Database connection is healthy (${responseTime}ms)`,
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
      });
    }

    // Проверка памяти с более детальной информацией
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const maxMemoryMB = 1024; // Увеличенный лимит для production

    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    if (heapUsagePercent < 80) {
      checks.push({
        name: 'memory',
        status: 'healthy',
        message: `Memory: ${heapUsedMB}/${heapTotalMB}MB heap (${heapUsagePercent}%), ${rssMB}MB RSS`,
      });
    } else if (heapUsagePercent < 90) {
      checks.push({
        name: 'memory',
        status: 'degraded',
        message: `Memory usage high: ${heapUsedMB}/${heapTotalMB}MB heap (${heapUsagePercent}%)`,
      });
    } else {
      checks.push({
        name: 'memory',
        status: 'unhealthy',
        message: `Memory usage critical: ${heapUsedMB}/${heapTotalMB}MB heap (${heapUsagePercent}%)`,
      });
    }

    // Проверка Event Loop Lag
    const eventLoopLag = await this.measureEventLoopLag();
    if (eventLoopLag < 10) {
      checks.push({
        name: 'event_loop',
        status: 'healthy',
        message: `Event loop lag: ${eventLoopLag.toFixed(2)}ms`,
      });
    } else if (eventLoopLag < 50) {
      checks.push({
        name: 'event_loop',
        status: 'degraded',
        message: `Event loop lag elevated: ${eventLoopLag.toFixed(2)}ms`,
      });
    } else {
      checks.push({
        name: 'event_loop',
        status: 'unhealthy',
        message: `Event loop lag critical: ${eventLoopLag.toFixed(2)}ms`,
      });
    }

    // Проверка uptime
    const uptimeSeconds = process.uptime();
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    checks.push({
      name: 'uptime',
      status: 'healthy',
      message: `Service uptime: ${uptimeMinutes} minutes`,
    });

    return checks;
  }

  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        resolve(lag);
      });
    });
  }

  private checkMemoryUsage(): 'healthy' | 'degraded' | 'unhealthy' {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;

    // Alert if heap usage is over 80%
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (heapUsagePercent > 90) {
      return 'unhealthy';
    } else if (heapUsagePercent > 80) {
      return 'degraded';
    }

    return 'healthy';
  }

  private getMemoryStatusMessage(): string {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    return `Memory: ${heapUsedMB}/${heapTotalMB}MB heap (${heapUsagePercent}%)`;
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
