import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { RedisService } from '../redis/redis.service';

export type ServiceHealthStatus = {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  error?: string;
};

export type DetailedHealthCheck = {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  services: ServiceHealthStatus[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    redis: {
      connected: boolean;
      responseTime?: number;
    };
  };
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly healthCache = new Map<string, ServiceHealthStatus>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    private readonly registry: ServiceRegistryService,
    private readonly redisService: RedisService,
  ) { }

  async checkGateway(): Promise<{
    status: 'ok' | 'error';
    timestamp: string;
    uptime: number;
  }> {
    try {
      // Perform basic system checks
      const memoryUsage = process.memoryUsage();
      const isHealthy = memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9; // Less than 90% memory usage

      return {
        status: isHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      };
    } catch (error) {
      this.logger.error('Gateway health check failed:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      };
    }
  }

  async checkDetailedHealth(): Promise<DetailedHealthCheck> {
    const [gatewayHealth, servicesHealth, systemHealth] = await Promise.all([
      this.checkGateway(),
      this.checkServices(),
      this.checkSystemHealth(),
    ]);

    const overallStatus = gatewayHealth.status === 'ok' &&
      servicesHealth.every(s => s.status === 'healthy') ? 'ok' : 'error';

    return {
      status: overallStatus,
      timestamp: gatewayHealth.timestamp,
      uptime: gatewayHealth.uptime,
      services: servicesHealth,
      system: systemHealth,
    };
  }

  async checkServices(): Promise<ServiceHealthStatus[]> {
    const services = this.registry.getAll();
    if (!services || !Array.isArray(services)) {
      this.logger.warn('No services found in registry');
      return [];
    }
    
    const results: ServiceHealthStatus[] = [];

    // Check services in parallel for better performance
    const healthChecks = services.map(async (svc) => {
      const cacheKey = `health:${svc.name}`;
      const cached = this.healthCache.get(cacheKey);

      // Return cached result if still valid
      if (cached && Date.now() - new Date(cached.lastCheck).getTime() < this.CACHE_TTL) {
        return cached;
      }

      const start = Date.now();
      try {
        const url = `${svc.baseUrl.replace(/\/$/, '')}${svc.healthCheckPath}`;
        const resp = await axios.get(url, {
          timeout: Math.min(svc.timeout, 5000), // Cap timeout at 5 seconds for health checks
          validateStatus: () => true,
        });
        const responseTime = Date.now() - start;
        const isHealthy = resp.status >= 200 && resp.status < 300;

        const healthStatus: ServiceHealthStatus = {
          name: svc.name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          error: isHealthy ? undefined : `HTTP ${resp.status}`,
        };

        // Cache the result
        this.healthCache.set(cacheKey, healthStatus);
        return healthStatus;
      } catch (e: any) {
        const responseTime = Date.now() - start;
        const healthStatus: ServiceHealthStatus = {
          name: svc.name,
          status: 'unhealthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          error: e?.message ?? 'Unknown error',
        };

        // Cache the error result too
        this.healthCache.set(cacheKey, healthStatus);
        return healthStatus;
      }
    });

    const healthResults = await Promise.allSettled(healthChecks);

    healthResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Fallback for promise rejection
        const service = services[index];
        results.push({
          name: service.name,
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          error: 'Health check promise rejected',
        });
      }
    });

    return results;
  }

  private async checkSystemHealth() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Check Redis connectivity
    let redisHealth: { connected: boolean; responseTime?: number } = { connected: false };
    try {
      const start = Date.now();
      await this.redisService.getClient().ping();
      redisHealth = {
        connected: true,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.warn('Redis health check failed:', error);
    }

    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to milliseconds
      },
      redis: redisHealth,
    };
  }

  async getServiceHealth(serviceName: string): Promise<ServiceHealthStatus | null> {
    const service = this.registry.getServiceConfig(serviceName);
    if (!service) {
      return null;
    }

    const start = Date.now();
    try {
      const url = `${service.baseUrl.replace(/\/$/, '')}${service.healthCheckPath}`;
      const resp = await axios.get(url, {
        timeout: service.timeout,
        validateStatus: () => true,
      });
      const responseTime = Date.now() - start;
      const isHealthy = resp.status >= 200 && resp.status < 300;

      return {
        name: service.name,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: isHealthy ? undefined : `HTTP ${resp.status}`,
      };
    } catch (e: any) {
      const responseTime = Date.now() - start;
      return {
        name: service.name,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: e?.message ?? 'Unknown error',
      };
    }
  }

  clearHealthCache(): void {
    this.healthCache.clear();
    this.logger.debug('Health cache cleared');
  }
}
