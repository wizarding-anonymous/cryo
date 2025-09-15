import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ServiceRegistryService } from '../registry/service-registry.service';

export type ServiceHealthStatus = {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  error?: string;
};

@Injectable()
export class HealthService {
  constructor(private readonly registry: ServiceRegistryService) {}

  async checkGateway(): Promise<{ status: 'ok' | 'error'; timestamp: string; uptime: number }>
  {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  async checkServices(): Promise<ServiceHealthStatus[]> {
    const services = this.registry.getAll();
    const results: ServiceHealthStatus[] = [];
    for (const svc of services) {
      const start = Date.now();
      try {
        const url = `${svc.baseUrl.replace(/\/$/, '')}${svc.healthCheckPath}`;
        const resp = await axios.get(url, { timeout: svc.timeout, validateStatus: () => true });
        const rt = Date.now() - start;
        const ok = resp.status >= 200 && resp.status < 300;
        results.push({
          name: svc.name,
          status: ok ? 'healthy' : 'unhealthy',
          responseTime: rt,
          lastCheck: new Date().toISOString(),
          error: ok ? undefined : `HTTP ${resp.status}`,
        });
      } catch (e: any) {
        const rt = Date.now() - start;
        results.push({
          name: svc.name,
          status: 'unhealthy',
          responseTime: rt,
          lastCheck: new Date().toISOString(),
          error: e?.message ?? 'Unknown error',
        });
      }
    }
    return results;
  }
}

