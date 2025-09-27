import { getEnvironmentDefaults, mergeEnvironmentConfig } from './index';

describe('Environment Configuration', () => {
  describe('getEnvironmentDefaults', () => {
    it('should return development configuration', () => {
      const config = getEnvironmentDefaults('development');

      expect(config.NODE_ENV).toBe('development');
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.LOG_FORMAT).toBe('simple');
      expect(config.THROTTLE_LIMIT).toBe(100);
      expect(config.POSTGRES_MAX_CONNECTIONS).toBe(5);
    });

    it('should return production configuration', () => {
      const config = getEnvironmentDefaults('production');

      expect(config.NODE_ENV).toBe('production');
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.LOG_FORMAT).toBe('json');
      expect(config.THROTTLE_LIMIT).toBe(60);
      expect(config.POSTGRES_MAX_CONNECTIONS).toBe(20);
    });

    it('should return test configuration', () => {
      const config = getEnvironmentDefaults('test');

      expect(config.NODE_ENV).toBe('test');
      expect(config.LOG_LEVEL).toBe('error');
      expect(config.LOG_FORMAT).toBe('simple');
      expect(config.THROTTLE_LIMIT).toBe(1000);
      expect(config.POSTGRES_MAX_CONNECTIONS).toBe(3);
      expect(config.METRICS_ENABLED).toBe(false);
      expect(config.HELMET_ENABLED).toBe(false);
    });

    it('should throw error for unknown environment', () => {
      expect(() => getEnvironmentDefaults('unknown')).toThrow(
        'No configuration found for environment: unknown',
      );
    });
  });

  describe('mergeEnvironmentConfig', () => {
    it('should merge defaults with environment variables', () => {
      const envVars = {
        PORT: '4000',
        LOG_LEVEL: 'warn',
        CUSTOM_VAR: 'custom_value',
      };

      const merged = mergeEnvironmentConfig('development', envVars);

      // Environment variables should override defaults
      expect(merged.PORT).toBe('4000');
      expect(merged.LOG_LEVEL).toBe('warn');

      // Defaults should be preserved when not overridden
      expect(merged.NODE_ENV).toBe('development');
      expect(merged.LOG_FORMAT).toBe('simple');

      // Custom variables should be included
      expect(merged.CUSTOM_VAR).toBe('custom_value');
    });

    it('should remove undefined values', () => {
      const envVars = {
        PORT: '4000',
        UNDEFINED_VAR: undefined,
      };

      const merged = mergeEnvironmentConfig('development', envVars);

      expect(merged.PORT).toBe('4000');
      expect(merged).not.toHaveProperty('UNDEFINED_VAR');
    });

    it('should prioritize environment variables over defaults', () => {
      const envVars = {
        NODE_ENV: 'custom',
        LOG_LEVEL: 'verbose',
        THROTTLE_LIMIT: 500,
      };

      const merged = mergeEnvironmentConfig('production', envVars);

      // Environment variables should win
      expect(merged.NODE_ENV).toBe('custom');
      expect(merged.LOG_LEVEL).toBe('verbose');
      expect(merged.THROTTLE_LIMIT).toBe(500);

      // Other defaults should remain
      expect(merged.LOG_FORMAT).toBe('json');
      expect(merged.POSTGRES_MAX_CONNECTIONS).toBe(20);
    });
  });
});
