import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, collectDefaultMetrics, Registry } from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly registry: Registry;

  constructor() {
    this.registry = register;
  }

  onModuleInit() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'auth_service_',
    });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  clearMetrics(): void {
    this.registry.clear();
  }
}