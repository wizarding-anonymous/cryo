import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServicesConfig } from '../config/services.config';
import type { ServiceConfig } from '../config/service-config.interface';

@Injectable()
export class ServiceRegistryService {
  private readonly services: ServicesConfig;

  constructor(private readonly configService: ConfigService) {
    this.services = this.configService.get<ServicesConfig>('services')!;
  }

  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    return this.services[serviceName];
  }

  getAll(): ServiceConfig[] {
    return Object.values(this.services);
  }
}
