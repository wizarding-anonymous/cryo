import 'reflect-metadata';
import { validate } from './env.validation';

describe('env.validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value as string;
    });
  });

  it('returns validated environment variables for valid input', () => {
    const validated = validate({
      PORT: '4000',
      DATABASE_HOST: 'db-host',
      NODE_ENV: 'development',
    });

    expect(validated.PORT).toBe(4000);
    expect(validated.DATABASE_HOST).toBe('db-host');
    expect(validated.NODE_ENV).toBe('development');
  });

  it('throws when validation fails', () => {
    expect(() => validate({ NODE_ENV: 'invalid-env' })).toThrow('Environment validation failed');
  });
});
