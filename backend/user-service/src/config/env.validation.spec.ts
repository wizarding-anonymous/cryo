import { envValidationSchema } from './env.validation';

describe('Environment Validation Schema', () => {
  describe('Required variables', () => {
    it('should validate when all required variables are provided', () => {
      const validEnv = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error } = envValidationSchema.validate(validEnv);
      expect(error).toBeUndefined();
    });

    it('should fail when required variables are missing', () => {
      const invalidEnv = {
        PORT: 3001,
      };

      const { error } = envValidationSchema.validate(invalidEnv, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(0); // Multiple required fields missing
    });
  });

  describe('PORT validation', () => {
    it('should use default port when not provided', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error, value } = envValidationSchema.validate(env);
      expect(error).toBeUndefined();
      expect(value.PORT).toBe(3001);
    });

    it('should fail when PORT is not a valid port number', () => {
      const invalidEnv = {
        PORT: 99999, // Invalid port
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error } = envValidationSchema.validate(invalidEnv);
      expect(error).toBeDefined();
    });
  });

  describe('NODE_ENV validation', () => {
    it('should accept valid NODE_ENV values', () => {
      const validEnvironments = ['development', 'production', 'test'];

      validEnvironments.forEach((nodeEnv) => {
        const env = {
          NODE_ENV: nodeEnv,
          POSTGRES_HOST: 'localhost',
          POSTGRES_USER: 'user',
          POSTGRES_PASSWORD: 'password',
          POSTGRES_DB: 'testdb',
          REDIS_HOST: 'localhost',
          ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
        };

        const { error } = envValidationSchema.validate(env);
        expect(error).toBeUndefined();
      });
    });

    it('should fail with invalid NODE_ENV value', () => {
      const invalidEnv = {
        NODE_ENV: 'invalid',
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error } = envValidationSchema.validate(invalidEnv);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('must be one of');
    });
  });

  describe('Database configuration', () => {
    it('should use default values for optional database settings', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error, value } = envValidationSchema.validate(env);
      expect(error).toBeUndefined();
      expect(value.POSTGRES_PORT).toBe(5432);
      expect(value.POSTGRES_MAX_CONNECTIONS).toBe(10);
      expect(value.POSTGRES_CONNECTION_TIMEOUT).toBe(30000);
    });
  });

  describe('Redis configuration', () => {
    it('should use default values for optional Redis settings', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      };

      const { error, value } = envValidationSchema.validate(env);
      expect(error).toBeUndefined();
      expect(value.REDIS_PORT).toBe(6379);
      expect(value.REDIS_DB).toBe(0);
      expect(value.REDIS_MAX_RETRIES).toBe(3);
      expect(value.REDIS_RETRY_DELAY).toBe(1000);
    });
  });

  describe('Optional external services', () => {
    it('should accept valid URLs for external services', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
        GAME_CATALOG_SERVICE_URL: 'http://localhost:3002',
        NOTIFICATION_SERVICE_URL: 'https://api.example.com/notifications',
      };

      const { error } = envValidationSchema.validate(env);
      expect(error).toBeUndefined();
    });

    it('should fail with invalid URLs for external services', () => {
      const env = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        REDIS_HOST: 'localhost',
        ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
        GAME_CATALOG_SERVICE_URL: 'not-a-valid-url',
      };

      const { error } = envValidationSchema.validate(env);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('must be a valid uri');
    });
  });
});
