import { productionConfig, validateProductionConfig } from './production.config';

describe('ProductionConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('productionConfig', () => {
    it('should return default configuration for development', () => {
      process.env.NODE_ENV = 'development';

      const config = productionConfig();

      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.database.synchronize).toBe(false);
      expect(config.logging.level).toBe('debug');
    });

    it('should return production configuration for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'info';

      const config = productionConfig();

      expect(config.server.port).toBe(8080);
      expect(config.logging.level).toBe('info');
      expect(config.server.helmet.enabled).toBe(true);
    });

    it('should configure CORS origins from environment', () => {
      process.env.CORS_ORIGIN = 'https://example.com,https://api.example.com';

      const config = productionConfig();

      expect(config.server.cors.origin).toEqual([
        'https://example.com',
        'https://api.example.com'
      ]);
    });

    it('should configure rate limiting from environment', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '30000';
      process.env.RATE_LIMIT_MAX = '500';

      const config = productionConfig();

      expect(config.server.rateLimit.windowMs).toBe(30000);
      expect(config.server.rateLimit.max).toBe(500);
    });

    it('should configure database SSL for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_SSL_CA = 'ca-cert';

      const config = productionConfig();

      expect(config.database.ssl).toBeTruthy();
      expect(config.database.ssl).toHaveProperty('ca', 'ca-cert');
    });

    it('should disable database SSL for development', () => {
      process.env.NODE_ENV = 'development';

      const config = productionConfig();

      expect(config.database.ssl).toBe(false);
    });

    it('should configure APM when enabled', () => {
      process.env.ELASTIC_APM_SERVER_URL = 'https://apm.example.com';
      process.env.ELASTIC_APM_SERVICE_NAME = 'test-service';

      const config = productionConfig();

      expect(config.apm.enabled).toBe(true);
      expect(config.apm.serverUrl).toBe('https://apm.example.com');
      expect(config.apm.serviceName).toBe('test-service');
    });

    it('should configure cache TTL values', () => {
      process.env.CACHE_TTL_LIBRARY = '600';
      process.env.CACHE_TTL_SEARCH = '180';

      const config = productionConfig();

      expect(config.redis.ttl.library).toBe(600);
      expect(config.redis.ttl.search).toBe(180);
    });
  });

  describe('validateProductionConfig', () => {
    it('should pass validation in development', () => {
      process.env.NODE_ENV = 'development';

      expect(() => validateProductionConfig()).not.toThrow();
    });

    it('should pass validation in production with all required vars', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_HOST = 'localhost';
      process.env.DATABASE_USERNAME = 'user';
      process.env.DATABASE_NAME = 'db';
      process.env.REDIS_HOST = 'localhost';

      // Mock file system for secrets
      const fs = require('fs');
      jest.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (typeof path === 'string') {
          if (path.includes('database-password.txt')) return 'db-password';
          if (path.includes('jwt-secret.txt')) return 'jwt-secret';
        }
        throw new Error('File not found');
      });

      expect(() => validateProductionConfig()).not.toThrow();

      fs.readFileSync.mockRestore();
    });

    it('should fail validation in production with missing required vars', () => {
      process.env.NODE_ENV = 'production';
      // Missing required environment variables

      expect(() => validateProductionConfig()).toThrow(/Missing required environment variables/);
    });

    it('should fail validation in production with missing secrets', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_HOST = 'localhost';
      process.env.DATABASE_USERNAME = 'user';
      process.env.DATABASE_NAME = 'db';
      process.env.REDIS_HOST = 'localhost';

      // Mock file system to simulate missing secrets
      const fs = require('fs');
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => validateProductionConfig()).toThrow(/Required secret/);

      fs.readFileSync.mockRestore();
    });
  });
});