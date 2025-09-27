import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { ServiceRegistryModule } from '../registry/service-registry.module';
import servicesConfig from './services.config';
import redisConfig from './redis.config';
import { validationSchema } from './validation.schema';

describe('Configuration Integration', () => {
  let module: TestingModule;
  let configService: ConfigService;
  let redisService: RedisService;
  let serviceRegistry: ServiceRegistryService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [servicesConfig, redisConfig],
          validationSchema,
        }),
        RedisModule.forRootAsync(),
        ServiceRegistryModule,
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
    serviceRegistry = module.get<ServiceRegistryService>(
      ServiceRegistryService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  describe('ConfigService', () => {
    it('should load Redis configuration', () => {
      const redisConfig = configService.get('redis');
      expect(redisConfig).toBeDefined();
      expect(redisConfig.host).toBeDefined();
      expect(redisConfig.port).toBe(6379);
      expect(redisConfig.keyPrefix).toBe('cryo:gateway:');
    });

    it('should load services configuration', () => {
      const services = configService.get('services');
      expect(services).toBeDefined();
      expect(services['user-service']).toBeDefined();
      expect(services['game-catalog-service']).toBeDefined();
      expect(services['payment-service']).toBeDefined();
      expect(Object.keys(services)).toHaveLength(11); // All 11 services
    });

    it('should validate environment variables', () => {
      // If we get here, validation passed during module initialization
      expect(configService.get('NODE_ENV')).toBeDefined();
      expect(configService.get('PORT')).toBeDefined();
    });
  });

  describe('RedisService', () => {
    it('should provide Redis client', () => {
      const client = redisService.getClient();
      expect(client).toBeDefined();
      expect(typeof client.set).toBe('function');
      expect(typeof client.get).toBe('function');
    });
  });

  describe('ServiceRegistryService', () => {
    it('should provide all configured services', () => {
      const allServices = serviceRegistry.getAll();
      expect(allServices).toHaveLength(11);

      const serviceNames = serviceRegistry.getAllServiceNames();
      expect(serviceNames).toContain('user-service');
      expect(serviceNames).toContain('game-catalog-service');
      expect(serviceNames).toContain('payment-service');
      expect(serviceNames).toContain('library-service');
      expect(serviceNames).toContain('notification-service');
      expect(serviceNames).toContain('review-service');
      expect(serviceNames).toContain('achievement-service');
      expect(serviceNames).toContain('security-service');
      expect(serviceNames).toContain('social-service');
      expect(serviceNames).toContain('download-service');
      expect(serviceNames).toContain('api-gateway');
    });

    it('should provide service configurations with correct structure', () => {
      const userService = serviceRegistry.getServiceConfig('user-service');
      expect(userService).toBeDefined();
      expect(userService!.name).toBe('user-service');
      expect(userService!.baseUrl).toBeDefined();
      expect(userService!.baseUrl).toContain('user-service');
      expect(userService!.timeout).toBe(5000);
      expect(userService!.retries).toBe(1);
      expect(userService!.healthCheckPath).toBe('/health');
    });

    it('should allow registering new services', async () => {
      const newService = {
        name: 'test-service',
        baseUrl: 'http://localhost:9999',
        timeout: 3000,
        retries: 2,
        healthCheckPath: '/health',
      };

      await serviceRegistry.registerService(newService);

      const retrievedService = serviceRegistry.getServiceConfig('test-service');
      expect(retrievedService).toEqual(newService);
    });
  });

  describe('Integration', () => {
    it('should have all modules properly wired together', () => {
      expect(configService).toBeDefined();
      expect(redisService).toBeDefined();
      expect(serviceRegistry).toBeDefined();

      // Verify that ServiceRegistry uses ConfigService
      const userService = serviceRegistry.getServiceConfig('user-service');
      expect(userService).toBeDefined();

      // Verify that RedisService has a working client
      const redisClient = redisService.getClient();
      expect(redisClient).toBeDefined();
    });
  });
});
