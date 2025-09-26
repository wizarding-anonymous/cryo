import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { ServicesConfig } from '../config/services.config';
import type { ServiceConfig } from '../config/service-config.interface';

@Injectable()
export class ServiceRegistryService {
  private readonly logger = new Logger(ServiceRegistryService.name);
  private readonly services: ServicesConfig;
  private readonly serviceConfigs: Map<string, ServiceConfig> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.services = this.configService.get<ServicesConfig>('services')!;
    // Initialize the service configs map
    Object.entries(this.services).forEach(([name, config]) => {
      this.serviceConfigs.set(name, config);
    });
  }

  async registerService(config: ServiceConfig): Promise<void> {
    this.logger.log(`Registering service: ${config.name}`);
    this.serviceConfigs.set(config.name, config);
  }

  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    return this.serviceConfigs.get(serviceName);
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const config = this.getServiceConfig(serviceName);
    if (!config) {
      this.logger.warn(`Service config not found: ${serviceName}`);
      return false;
    }

    try {
      const healthUrl = `${config.baseUrl}${config.healthCheckPath}`;
      const response = await axios.get(healthUrl, {
        timeout: Math.min(config.timeout, 3000), // Use shorter timeout for health checks
        validateStatus: (status) => status >= 200 && status < 300,
      });
      
      this.logger.debug(`Health check passed for ${serviceName}: ${response.status}`);
      return true;
    } catch (error) {
      this.logger.warn(`Health check failed for ${serviceName}:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  getAll(): ServiceConfig[] {
    return Array.from(this.serviceConfigs.values());
  }

  getAllServiceNames(): string[] {
    return Array.from(this.serviceConfigs.keys());
  }
}
