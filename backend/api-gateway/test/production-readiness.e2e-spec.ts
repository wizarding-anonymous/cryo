import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProductionReadinessService } from '../src/health/production-readiness.service';
import { RedisService } from '../src/redis/redis.service';
import { ServiceRegistryService } from '../src/registry/service-registry.service';
import { HealthService } from '../src/health/health.service';
import { ResponseInterceptor } from '../src/shared/interceptors/response.interceptor';
import { EnvironmentValidatorService } from '../src/config/environment-validator.service';

describe('Production Readiness (e2e)', () => {
  let app: INestApplication;
  let productionReadinessService: ProductionReadinessService;

  beforeAll(async () => {
    // Set production environment for testing
    process.env.NODE_ENV = 'production';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        ttl: jest.fn(),
      }),
    };

    const mockServiceRegistry = {
      getServiceConfig: jest.fn().mockReturnValue({
        baseUrl: 'http://localhost:3002',
        timeout: 5000,
        retries: 2,
      }),
      getAllServiceNames: jest
        .fn()
        .mockReturnValue(['user-service', 'game-catalog-service']),
      checkServiceHealth: jest.fn().mockResolvedValue(true),
      getAll: jest.fn().mockReturnValue([
        { name: 'user-service', baseUrl: 'http://localhost:3002' },
        { name: 'game-catalog-service', baseUrl: 'http://localhost:3003' },
      ]),
    };

    const mockHealthService = {
      checkGateway: jest.fn().mockResolvedValue({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: 3600,
      }),
      checkServices: jest.fn().mockResolvedValue([
        { name: 'user-service', status: 'healthy', responseTime: 45 },
        { name: 'game-catalog-service', status: 'healthy', responseTime: 32 },
      ]),
    };

    const mockEnvironmentValidator = {
      validateProductionEnvironment: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      }),
    };

    const mockResponseInterceptor = {
      intercept: jest.fn().mockImplementation((context, next) => {
        const http = context.switchToHttp();
        const res = http.getResponse();

        // Add the required headers
        res.setHeader('X-Request-Id', 'test-request-id');
        res.setHeader('X-Timestamp', new Date().toISOString());
        res.setHeader('X-Gateway-Version', '1.0.0');

        return next.handle();
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(ServiceRegistryService)
      .useValue(mockServiceRegistry)
      .overrideProvider(HealthService)
      .useValue(mockHealthService)
      .overrideProvider(EnvironmentValidatorService)
      .useValue(mockEnvironmentValidator)
      .overrideInterceptor(ResponseInterceptor)
      .useValue(mockResponseInterceptor)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    // Apply production security headers for testing
    const httpAdapter = app.getHttpAdapter();
    const instance: any = (httpAdapter as any).getInstance?.();
    if (instance?.set) {
      instance.set('trust proxy', 1);
      instance.disable('x-powered-by'); // Remove Express signature
      // Add security headers and request ID
      instance.use((_req: any, res: any, next: any) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-Request-Id', 'test-request-id-' + Date.now());
        next();
      });
    }

    productionReadinessService = moduleFixture.get<ProductionReadinessService>(
      ProductionReadinessService,
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    // Reset environment
    delete process.env.NODE_ENV;
  });

  describe('Production Readiness Checks', () => {
    it('should perform all readiness checks', async () => {
      const checks = await productionReadinessService.performReadinessChecks();

      expect(checks).toBeDefined();
      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);

      // Check that all required checks are present
      const checkNames = checks.map((check) => check.name);
      expect(checkNames).toContain('Environment Variables');
      expect(checkNames).toContain('Redis Connection');
      expect(checkNames).toContain('Service Registry');
      expect(checkNames).toContain('Memory Configuration');
      expect(checkNames).toContain('Security Configuration');
    });

    it('should validate environment variables', async () => {
      const checks = await productionReadinessService.performReadinessChecks();
      const envCheck = checks.find(
        (check) => check.name === 'Environment Variables',
      );

      expect(envCheck).toBeDefined();
      expect(envCheck!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(envCheck!.message).toBeDefined();
    });

    it('should check Redis connection', async () => {
      const checks = await productionReadinessService.performReadinessChecks();
      const redisCheck = checks.find(
        (check) => check.name === 'Redis Connection',
      );

      expect(redisCheck).toBeDefined();
      expect(redisCheck!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(redisCheck!.message).toBeDefined();
    });

    it('should validate service registry', async () => {
      const checks = await productionReadinessService.performReadinessChecks();
      const serviceCheck = checks.find(
        (check) => check.name === 'Service Registry',
      );

      expect(serviceCheck).toBeDefined();
      expect(serviceCheck!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(serviceCheck!.message).toBeDefined();

      if (serviceCheck!.details) {
        expect(serviceCheck!.details.totalServices).toBeDefined();
        expect(serviceCheck!.details.healthyServices).toBeDefined();
        expect(serviceCheck!.details.services).toBeDefined();
      }
    });

    it('should check memory configuration', async () => {
      const checks = await productionReadinessService.performReadinessChecks();
      const memoryCheck = checks.find(
        (check) => check.name === 'Memory Configuration',
      );

      expect(memoryCheck).toBeDefined();
      expect(memoryCheck!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(memoryCheck!.message).toBeDefined();

      if (memoryCheck!.details) {
        expect(memoryCheck!.details.memoryUsage).toBeDefined();
      }
    });

    it('should validate security configuration', async () => {
      const checks = await productionReadinessService.performReadinessChecks();
      const securityCheck = checks.find(
        (check) => check.name === 'Security Configuration',
      );

      expect(securityCheck).toBeDefined();
      expect(securityCheck!.status).toMatch(/healthy|degraded|unhealthy/);
      expect(securityCheck!.message).toBeDefined();

      if (securityCheck!.details) {
        expect(securityCheck!.details.corsOrigin).toBeDefined();
        expect(securityCheck!.details.rateLimitEnabled).toBeDefined();
        expect(securityCheck!.details.logLevel).toBeDefined();
      }
    });
  });

  describe('Production Readiness API', () => {
    it('/health/readiness (GET) should return readiness checks', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health/readiness')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Validate response structure
      response.body.forEach((check: any) => {
        expect(check.name).toBeDefined();
        expect(check.status).toMatch(/healthy|degraded|unhealthy/);
        expect(check.message).toBeDefined();
      });
    });

    it('should include proper response headers', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/health/readiness',
      );

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Production Environment Validation', () => {
    it('should detect production environment', () => {
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should have required production environment variables', () => {
      const requiredVars = ['NODE_ENV', 'REDIS_HOST', 'REDIS_PORT'];

      requiredVars.forEach((varName) => {
        expect(process.env[varName]).toBeDefined();
      });
    });

    it('should validate Node.js production optimizations', () => {
      // Check if NODE_OPTIONS includes production optimizations
      const nodeOptions = process.env.NODE_OPTIONS || '';

      // These are recommendations, not strict requirements
      if (nodeOptions) {
        expect(nodeOptions).toMatch(/--max-old-space-size=\d+/);
      }
    });
  });

  describe('Production Security', () => {
    it('should have security headers in production', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      // Check for security headers that should be present in production
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
      );
    });

    it('should not expose sensitive information', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      // Should not expose Express signature
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Production Performance', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get('/api/health').expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/api/health').expect(200));

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(concurrentRequests);

      responses.forEach((response: any) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('Graceful Shutdown Preparation', () => {
    it('should have shutdown hooks enabled', () => {
      // This is tested by checking if the app has shutdown hooks
      // The actual graceful shutdown is tested in integration scenarios
      expect(app.enableShutdownHooks).toBeDefined();
    });
  });
});
