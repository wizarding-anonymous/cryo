import { ServiceRegistryService } from './service-registry.service';

describe('ServiceRegistryService', () => {
  it('returns service config and list', () => {
    const services = {
      'user-service': { name: 'user-service', baseUrl: 'http://u', timeout: 100, retries: 0, healthCheckPath: '/health' },
      'game-catalog-service': { name: 'game-catalog-service', baseUrl: 'http://g', timeout: 100, retries: 0, healthCheckPath: '/health' },
    } as any;
    const cfg = { get: (key: string) => (key === 'services' ? services : undefined) } as any;
    const registry = new ServiceRegistryService(cfg);
    expect(registry.getServiceConfig('user-service')!.baseUrl).toBe('http://u');
    expect(registry.getAll()).toHaveLength(2);
  });
});

