import databaseConfig from './database.config';
import redisConfig from './redis.config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

describe('Database Configuration', () => {
  describe('PostgreSQL Configuration', () => {
    it('should return valid database configuration', () => {
      const config = databaseConfig() as PostgresConnectionOptions;
      
      expect(config.type).toBe('postgres');
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.username).toBeDefined();
      expect(config.password).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.entities).toBeDefined();
      expect(config.migrations).toBeDefined();
    });

    it('should use environment variables when available', () => {
      process.env.DATABASE_HOST = 'test-host';
      process.env.DATABASE_PORT = '5433';
      process.env.DATABASE_USERNAME = 'test-user';
      process.env.DATABASE_PASSWORD = 'test-password';
      process.env.DATABASE_NAME = 'test-db';

      const config = databaseConfig() as PostgresConnectionOptions;
      
      expect(config.host).toBe('test-host');
      expect(config.port).toBe(5433);
      expect(config.username).toBe('test-user');
      expect(config.password).toBe('test-password');
      expect(config.database).toBe('test-db');

      // Cleanup
      delete process.env.DATABASE_HOST;
      delete process.env.DATABASE_PORT;
      delete process.env.DATABASE_USERNAME;
      delete process.env.DATABASE_PASSWORD;
      delete process.env.DATABASE_NAME;
    });
  });

  describe('Redis Configuration', () => {
    it('should return valid redis configuration', () => {
      const config = redisConfig() as any;
      
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.ttl).toBeDefined();
      expect(config.max).toBeDefined();
    });

    it('should use environment variables when available', () => {
      process.env.REDIS_HOST = 'test-redis-host';
      process.env.REDIS_PORT = '6380';

      const config = redisConfig() as any;
      
      expect(config.host).toBe('test-redis-host');
      expect(config.port).toBe(6380);

      // Cleanup
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
    });
  });
});